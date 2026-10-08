import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import type { Category } from '../../models/category';

interface RegistroForm {
  name: string;
  categoryId: string;
  description: string;
  address: string;
  zone: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  latitude: string;
  longitude: string;
  priceRange: string;
}

const emptyForm = (): RegistroForm => ({
  name: '',
  categoryId: '',
  description: '',
  address: '',
  zone: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  latitude: '',
  longitude: '',
  priceRange: '$',
});

const STEPS = [
  { label: 'Negocio', icon: '🏪' },
  { label: 'Ubicación', icon: '📍' },
  { label: 'Contacto', icon: '📞' },
  { label: 'Confirmar', icon: '✅' },
];

/** Registro público de un negocio: la ficha queda en revisión (admin aprueba). */
@Component({
  selector: 'lm-registro',
  imports: [RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly categories = signal<Category[]>([]);
  readonly form = signal<RegistroForm>(emptyForm());
  readonly sending = signal(false);
  readonly done = signal<string | null>(null);
  readonly error = signal('');
  readonly step = signal(0);

  readonly steps = STEPS;

  readonly progress = computed(() => ((this.step() + 1) / STEPS.length) * 100);

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
  }

  set(key: string, value: string | number) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  nextStep() {
    this.error.set('');
    const f = this.form();

    if (this.step() === 0) {
      if (!f.name.trim()) { this.error.set('El nombre del negocio es obligatorio'); return; }
      if (!f.categoryId) { this.error.set('Selecciona una categoría'); return; }
    }

    if (this.step() < STEPS.length - 1) {
      this.step.update(s => s + 1);
    }
  }

  prevStep() {
    this.error.set('');
    if (this.step() > 0) this.step.update(s => s - 1);
  }

  goToStep(i: number) {
    if (i < this.step()) {
      this.step.set(i);
      this.error.set('');
    }
  }

  submit() {
    const f = this.form();
    this.error.set('');
    const name = f.name.trim();

    if (!name) { this.error.set('El nombre del negocio es obligatorio'); return; }
    if (!f.categoryId) { this.error.set('Selecciona una categoría'); return; }

    const user = this.auth.user();
    const username = user?.username || '';
    const password = ''; // account already created via /login

    this.sending.set(true);
    this.api
      .registerBusiness({
        name,
        categoryId: f.categoryId,
        description: f.description.trim(),
        address: f.address.trim(),
        zone: f.zone.trim(),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim(),
        email: f.email.trim(),
        website: f.website.trim(),
        latitude: this.parseNumber(f.latitude) || 0,
        longitude: this.parseNumber(f.longitude) || 0,
        priceRange: f.priceRange.trim() || '$',
        username,
        password,
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.done.set(r.message);
        },
        error: (e) => {
          this.sending.set(false);
          this.error.set(e?.error?.message || 'No se pudo enviar el registro');
        },
      });
  }

  get categoryName(): string {
    const cat = this.categories().find(c => c._id === this.form().categoryId);
    return cat?.name || '—';
  }
}