import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import type { Business } from '../../models/business';
import type { Category } from '../../models/category';

/** Página de entrada: hero + stats + secciones, con botones hacia el directorio. */
@Component({
  selector: 'lm-landing',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly businesses = signal<Business[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly featured = computed(() => {
    const destacados = this.businesses().filter(
      (b) => b.featured && (b.photoUrls ?? []).length
    );
    return (destacados.length ? destacados : this.businesses()).slice(0, 3);
  });

  readonly stats = computed(() => ({
    negocios: this.businesses().length,
    categorias: this.categories().length,
    zonas: new Set(this.businesses().map((b) => b.zone).filter(Boolean)).size,
  }));

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.businesses().subscribe((b) => {
      this.businesses.set(b);
      this.loading.set(false);
    });
  }

  catName(id: string): string {
    return this.categories().find((c) => c._id === id)?.name ?? 'Negocio';
  }
}