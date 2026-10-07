import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import type { Category } from '../../models/category';

interface RegistroForm {
  name: string;
  categoryId: string;
  description: string;
  address: string;
  zone: string;
  phone: string;
  whatsapp: string;
  latitude: string;
  longitude: string;
  priceRange: string;
  username: string;
  password: string;
}

const emptyForm = (): RegistroForm => ({
  name: '',
  categoryId: '',
  description: '',
  address: '',
  zone: '',
  phone: '',
  whatsapp: '',
  latitude: '',
  longitude: '',
  priceRange: '$',
  username: '',
  password: '',
});

/** Registro público de un negocio: la ficha queda en revisión (admin aprueba). */
@Component({
  selector: 'lm-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly categories = signal<Category[]>([]);
  readonly form = signal<RegistroForm>(emptyForm());
  readonly sending = signal(false);
  readonly done = signal<string | null>(null);
  readonly error = signal('');

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
  }

  set(key: string, value: string | number) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  submit() {
    const f = this.form();
    this.error.set('');
    const name = f.name.trim();
    const username = f.username.trim().toLowerCase();
    const password = f.password;

    if (!name) {
      this.error.set('El nombre del negocio es obligatorio');
      return;
    }
    if (!f.categoryId) {
      this.error.set('Selecciona una categoría');
      return;
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      this.error.set('El usuario debe tener entre 3 y 30 caracteres (letras, números, punto o guión)');
      return;
    }
    if (password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }

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
}