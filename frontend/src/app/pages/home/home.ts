import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { GeolocationService } from '../../services/geolocation.service';
import { FavoritesService } from '../../services/favorites.service';
import { distanceKm, formatDistance } from '../../utils/location';
import { isOpenNow } from '../../utils/open-hours';
import { activePromo } from '../../utils/promo';
import type { Business } from '../../models/business';
import type { Category } from '../../models/category';

type SortMode = 'distance' | 'rating' | 'name';

const RATING_OPTIONS = [0, 1, 2, 3, 3.5, 4, 4.5, 5];
const PRICE_OPTIONS = ['$', '$$', '$$$'];

@Component({
  selector: 'lm-home',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly geo = inject(GeolocationService);
  readonly favs = inject(FavoritesService);

  readonly loading = signal(true);
  readonly businesses = signal<Business[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly zones = signal<string[]>([]);
  readonly selectedCategory = signal<string | null>(null);
  readonly selectedZone = signal<string | null>(null);
  readonly query = signal('');
  readonly sortBy = signal<SortMode>('distance');
  readonly onlyOpen = signal(false);
  readonly onlyFavs = signal(false);

  /** Existe al menos un negocio guardado en favoritos (localStorage). */
  readonly hasFavs = computed(() => this.favs.ids().length > 0);

  // Filtros avanzados: se traducen a operadores de MongoDB en el backend
  // (ratingMin/ratingMax -> $gte/$lte · price -> $in · destacado/verificado ->
  // $eq · promo -> $exists+$ne · conFotos -> $not {$size:0} · fotos -> $size).
  readonly showAdvanced = signal(false);
  readonly ratingMin = signal<number | null>(null);
  readonly ratingMax = signal<number | null>(null);
  readonly prices = signal<string[]>([]);
  readonly onlyFeatured = signal(false);
  readonly onlyVerified = signal(false);
  readonly onlyPromo = signal(false);
  readonly withPhotos = signal(false);
  readonly fotosExactas = signal<number | null>(null);
  readonly onlyDelivery = signal(false);

  // Paginación: 9 fichas por página; la página se resetea al filtrar/ordenar.
  readonly pageSize = 9;
  readonly page = signal(1);

  readonly ratingOptions = RATING_OPTIONS;
  readonly priceOptions = PRICE_OPTIONS;

  private readonly userPos = this.geo.position;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // El servidor ya aplicó los filtros (operadores MongoDB); aquí solo quedan
  // los criterios que dependen del navegador: "abierto ahora" y favoritos.
  readonly filtered = computed(() => {
    const open = this.onlyOpen();
    // Si no quedan favoritos el filtro se ignora para no dejar la lista vacía.
    const favsOnly = this.onlyFavs() && this.hasFavs();

    const list = this.businesses().filter((b) => {
      const matchOpen = !open || isOpenNow(b.hours);
      const matchFav = !favsOnly || this.favs.isFav(b._id);
      return matchOpen && matchFav;
    });

    const mode = this.sortBy();
    return [...list].sort((a, b) => {
      if (mode === 'rating') return b.rating - a.rating;
      if (mode === 'name') return a.name.localeCompare(b.name, 'es');
      const da = this.distanceOf(a);
      const db = this.distanceOf(b);
      if (!Number.isFinite(da)) return 1;
      if (!Number.isFinite(db)) return -1;
      return da - db;
    });
  });

  // --- Paginación sobre la lista ya filtrada y ordenada ---
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  // La página actual nunca puede exceder el total de páginas (si los filtros
  // reducen la lista, se clampa automáticamente a la última válida).
  readonly safePage = computed(() => Math.min(this.page(), this.pageCount()));

  readonly visible = computed(() => {
    const start = (this.safePage() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly startIndex = computed(() => (this.safePage() - 1) * this.pageSize + 1);
  readonly endIndex = computed(() =>
    Math.min(this.safePage() * this.pageSize, this.filtered().length)
  );
  readonly totalResults = computed(() => this.filtered().length);
  readonly pages = computed(() =>
    Array.from({ length: this.pageCount() }, (_, i) => i + 1)
  );

  /** Cuántos filtros avanzados están activos (para el marcador del botón). */
  readonly advancedCount = computed(() => {
    let n = 0;
    if (this.ratingMin() !== null) n += 1;
    if (this.ratingMax() !== null) n += 1;
    n += this.prices().length;
    if (this.onlyFeatured()) n += 1;
    if (this.onlyVerified()) n += 1;
    if (this.onlyPromo()) n += 1;
    if (this.withPhotos()) n += 1;
    if (this.fotosExactas() !== null) n += 1;
    if (this.onlyDelivery()) n += 1;
    return n;
  });

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.zones().subscribe((zs) => this.zones.set(zs.map((z) => z._id).filter(Boolean)));
    this.reload();
    this.geo.request();
  }

  /** Pide al backend la lista ya filtrada (los operadores viven en MongoDB). */
  reload() {
    this.loading.set(true);
    this.api.businesses(this.buildParams()).subscribe({
      next: (b) => {
        this.businesses.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.businesses.set([]);
        this.loading.set(false);
      },
    });
    this.page.set(1);
  }

  private buildParams() {
    return {
      q: this.query().trim() || undefined,
      category: this.selectedCategory() ?? undefined,
      zone: this.selectedZone() ?? undefined,
      ratingMin: this.ratingMin() ?? undefined,
      ratingMax: this.ratingMax() ?? undefined,
      price: this.prices().length ? this.prices().join(',') : undefined,
      featured: this.onlyFeatured() || undefined,
      verified: this.onlyVerified() || undefined,
      promo: this.onlyPromo() || undefined,
      photos: this.withPhotos() || undefined,
      fotos: this.fotosExactas() ?? undefined,
      delivery: this.onlyDelivery() || undefined,
    };
  }

  distanceOf(b: Business): number {
    const pos = this.userPos();
    if (!pos) return Number.POSITIVE_INFINITY;
    return distanceKm(pos.latitude, pos.longitude, b.latitude, b.longitude);
  }

  distanceLabel(b: Business): string {
    return formatDistance(this.distanceOf(b));
  }

  categoryName(id: string): string {
    return this.categories().find((c) => c._id === id)?.name ?? id;
  }

  openLabel(b: Business): string {
    return isOpenNow(b.hours) ? 'Abierto' : 'Cerrado';
  }

  isOpen(b: Business): boolean {
    return isOpenNow(b.hours);
  }

  valueOf(n: number | null): string {
    return n === null ? '' : String(n);
  }

  toggleAdvanced() {
    this.showAdvanced.set(!this.showAdvanced());
  }

  toggleCategory(id: string) {
    this.selectedCategory.set(this.selectedCategory() === id ? null : id);
    this.reload();
  }

  toggleZone(zone: string) {
    this.selectedZone.set(this.selectedZone() === zone ? null : zone);
    this.reload();
  }

  clearZone() {
    this.selectedZone.set(null);
    this.reload();
  }

  clearCategory() {
    this.selectedCategory.set(null);
    this.reload();
  }

  setQuery(value: string) {
    this.query.set(value);
    this.page.set(1);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 350);
  }

  setSort(mode: string) {
    this.sortBy.set(mode as SortMode);
    this.page.set(1);
  }

  setOpen(checked: boolean) {
    this.onlyOpen.set(checked);
    this.page.set(1);
  }

  setFavs() {
    this.onlyFavs.set(!this.onlyFavs());
    this.page.set(1);
  }

  // --- Filtros avanzados (operadores en el backend) ---

  parseNumber(value: string): number | null {
    if (value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  setRatingMin(value: string) {
    this.ratingMin.set(this.parseNumber(value));
    this.reload();
  }

  setRatingMax(value: string) {
    this.ratingMax.set(this.parseNumber(value));
    this.reload();
  }

  togglePrice(p: string) {
    this.prices.update((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p]
    );
    this.reload();
  }

  priceActive(p: string): boolean {
    return this.prices().includes(p);
  }

  toggleFeatured() {
    this.onlyFeatured.set(!this.onlyFeatured());
    this.reload();
  }

  toggleVerified() {
    this.onlyVerified.set(!this.onlyVerified());
    this.reload();
  }

  togglePromo() {
    this.onlyPromo.set(!this.onlyPromo());
    this.reload();
  }

  togglePhotos() {
    this.withPhotos.set(!this.withPhotos());
    this.reload();
  }

  toggleDelivery() {
    this.onlyDelivery.set(!this.onlyDelivery());
    this.reload();
  }

  setFotos(value: string) {
    this.fotosExactas.set(this.parseNumber(value));
    this.reload();
  }

  clearAdvanced() {
    this.ratingMin.set(null);
    this.ratingMax.set(null);
    this.prices.set([]);
    this.onlyFeatured.set(false);
    this.onlyVerified.set(false);
    this.onlyPromo.set(false);
    this.withPhotos.set(false);
    this.fotosExactas.set(null);
    this.onlyDelivery.set(false);
    this.reload();
  }

  goToPage(p: number) {
    const target = Math.max(1, Math.min(p, this.pageCount()));
    if (target === this.page()) return;
    this.page.set(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  hasPromo(biz: Business): boolean {
    return activePromo(biz);
  }

  isFav(id: string | undefined): boolean {
    return this.favs.isFav(id);
  }

  toggleFav(id: string | undefined) {
    this.favs.toggle(id);
  }
}