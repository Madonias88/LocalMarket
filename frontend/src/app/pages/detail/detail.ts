import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import * as L from 'leaflet';
import { ApiService } from '../../services/api.service';
import { GeolocationService } from '../../services/geolocation.service';
import { FavoritesService } from '../../services/favorites.service';
import { QrViewComponent } from '../../components/qr-view/qr-view';
import { distanceKm, formatDistance } from '../../utils/location';
import { openNowLabel } from '../../utils/open-hours';
import { activePromo } from '../../utils/promo';
import type { Business, BusinessPromo } from '../../models/business';
import type { Category } from '../../models/category';
import type { Review } from '../../models/review';

@Component({
  selector: 'lm-detail',
  imports: [RouterLink, DecimalPipe, DatePipe, QrViewComponent],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class DetailPage implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly geo = inject(GeolocationService);
  readonly favs = inject(FavoritesService);

  readonly showQr = signal(false);

  @ViewChild('map', { read: ElementRef }) mapElement!: ElementRef<HTMLDivElement>;

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly business = signal<Business | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly selectedPhoto = signal(0);

  readonly reviews = signal<Review[]>([]);
  readonly reviewCount = signal(0);
  readonly reviewAverage = signal(0);

  readonly reviewName = signal('');
  readonly reviewRating = signal(5);
  readonly reviewComment = signal('');
  readonly reviewError = signal('');
  readonly reviewSent = signal(false);
  readonly submitting = signal(false);

  private map?: L.Map;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.business(id).subscribe({
      next: (b) => {
        this.business.set(b);
        this.loading.set(false);
        this.loadReviews();
        setTimeout(() => this.initMap(), 50);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
    this.geo.request();
  }

  ngAfterViewInit() {
    // el mapa se inicializa al llegar el negocio (ver ngOnInit)
  }

  private loadReviews() {
    const id = this.business()?._id;
    if (!id) return;
    this.api.reviews(id).subscribe((r) => {
      this.reviews.set(r.reviews);
      this.reviewCount.set(r.count);
      this.reviewAverage.set(r.average);
    });
  }

  setRating(value: string) {
    const n = Number(value);
    this.reviewRating.set(Number.isInteger(n) ? n : 5);
  }

  submitReview() {
    const id = this.business()?._id;
    if (!id) return;
    const name = this.reviewName().trim();
    if (!name) {
      this.reviewError.set('Escribe tu nombre');
      return;
    }
    this.submitting.set(true);
    this.reviewError.set('');
    this.api
      .submitReview(id, {
        userName: name,
        rating: this.reviewRating(),
        comment: this.reviewComment().trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.reviewSent.set(true);
        },
        error: () => {
          this.submitting.set(false);
          this.reviewError.set('No se pudo enviar tu reseña. Inténtalo de nuevo.');
        },
      });
  }

  hasPromo(): boolean {
    return activePromo(this.business());
  }

  /**
   * Ofertas estructuradas vigentes. Cada promo tiene su propia vigencia
   * (desde/hasta en YYYY-MM-DD; vacío = sin límite).
   */
  activePromos(): BusinessPromo[] {
    const now = new Date();
    return (this.business()?.promos ?? []).filter((p) => {
      if (!p.titulo) return false;
      if (p.desde && new Date(p.desde) > now) return false;
      if (p.hasta && new Date(p.hasta) < now) return false;
      return true;
    });
  }

  deliverySummary(): string {
    const b = this.business();
    if (!b?.delivery) return '';
    const fee = (b.deliveryFee ?? 0) > 0 ? `Q${b.deliveryFee}` : 'Gratis';
    const zones = b.deliveryZones?.length ? ` · ${b.deliveryZones.join(', ')}` : '';
    const min = (b.minOrder ?? 0) > 0 ? ` · mín. Q${b.minOrder}` : '';
    return `Envío ${fee}${zones}${min}`;
  }

  paymentLabel(): string {
    return (this.business()?.paymentMethods ?? []).join(', ');
  }

  /** Normaliza una URL de sitio web (añade https:// si falta). */
  urlOf(url: string): string {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  /** Convierte usuario/handle de red social en su perfil público. */
  socialUrl(kind: 'instagram' | 'facebook', handle: string): string {
    const clean = handle.replace(/^@/, '').trim();
    const base = kind === 'instagram' ? 'https://instagram.com/' : 'https://facebook.com/';
    return base + clean;
  }

  private initMap() {
    const b = this.business();
    if (!b || !this.mapElement) return;
    if ((b.latitude === 0 && b.longitude === 0) || !b.zone) return;

    if (this.map) this.map.remove();

    this.map = L.map(this.mapElement.nativeElement, { scrollWheelZoom: false }).setView(
      [b.latitude, b.longitude],
      15
    );

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    L.circleMarker([b.latitude, b.longitude], {
      radius: 9,
      color: '#0f766e',
      fillColor: '#0f766e',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(`<strong>${b.name}</strong><br/>${b.address}`)
      .addTo(this.map);
  }

  photos(): string[] {
    const b = this.business();
    return (b?.photoUrls?.length ? b.photoUrls : ['https://picsum.photos/seed/default/900/500']);
  }

  photo(): string {
    return this.photos()[this.selectedPhoto()] ?? this.photos()[0];
  }

  categoryName(id: string): string {
    return this.categories().find((c) => c._id === id)?.name ?? id;
  }

  distanceLabel(): string {
    const b = this.business();
    const pos = this.geo.position();
    if (!b || !pos) return '';
    return formatDistance(
      distanceKm(pos.latitude, pos.longitude, b.latitude, b.longitude)
    );
  }

  statusLabel(): string {
    return openNowLabel(this.business()?.hours);
  }

  stars(n: number): number[] {
    return Array.from({ length: Math.round(n) }, (_, i) => i + 1);
  }

  waLink(): string {
    return `https://wa.me/${this.business()?.whatsapp || ''}`;
  }

  phoneLink(): string {
    return `tel:${this.business()?.phone || ''}`;
  }

  mapsLink(): string {
    const b = this.business();
    return `https://www.google.com/maps/dir/?api=1&destination=${b?.latitude},${b?.longitude}`;
  }

  wazeLink(): string {
    const b = this.business();
    return `https://waze.com/ul?ll=${b?.latitude},${b?.longitude}&navigate=yes`;
  }

  // --- Compartir / guardar ---

  currentUrl(): string {
    return window.location.href.split('?')[0];
  }

  isFav(): boolean {
    const b = this.business();
    return b ? this.favs.isFav(b._id) : false;
  }

  toggleFav() {
    const b = this.business();
    if (b) this.favs.toggle(b._id);
  }

  toggleQr() {
    this.showQr.set(!this.showQr());
  }

  /** Comparte en WhatsApp o con el menú nativo del dispositivo. */
  share() {
    const b = this.business();
    if (!b) return;
    const text = `${b.name} · LocalMarket — ${b.description || 'Directorio de negocios locales'}`;
    const url = this.currentUrl();
    if (typeof navigator.share === 'function') {
      navigator
        .share({ title: `${b.name} · LocalMarket`, text, url })
        .catch(() => undefined);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
    }
  }

  shareWhatsAppLink(): string {
    const b = this.business();
    const text = b ? `${b.name} · LocalMarket — ${b.description || ''}` : '';
    return `https://wa.me/?text=${encodeURIComponent(`${text} ${this.currentUrl()}`)}`;
  }

  formatHours(hours: Record<string, string> | undefined): [string, string][] {
    return Object.entries(hours ?? {});
  }
}