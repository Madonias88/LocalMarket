import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import type { Observable } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import type { Business } from '../../models/business';
import type { Category } from '../../models/category';
import type { Review } from '../../models/review';
import { listToText, textToList, promosToText, textToPromos } from '../../utils/lists';
import {
  cleanPhoneInput,
  cleanWhatsAppInput,
  cleanEmailInput,
  cleanWebsiteInput,
  validatePhone,
  validateWhatsApp,
  validateEmail,
  validateWebsite,
  normalizeWebsiteUrl,
} from '../../utils/form-validators';

interface FormState {
  _id?: string;
  name: string;
  categoryId: string;
  description: string;
  address: string;
  zone: string;
  phone: string;
  whatsapp: string;
  latitude: number;
  longitude: number;
  priceRange: string;
  rating: number;
  verified: boolean;
  featured: boolean;
  photoUrls: string;
  promoText: string;
  promoStart: string;
  promoEnd: string;
  // --- Extras (mismos campos que mi-negocio + popularidad) ---
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  serviciosText: string;
  tagsText: string;
  delivery: boolean;
  deliveryZonesText: string;
  deliveryFee: number;
  minOrder: number;
  paymentMethodsText: string;
  promosText: string;
  viewsCount: number;
  reviewCount: number;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  pendingReviews: number;
  byCategory: { _id: string; count: number }[];
  zones: { _id: string; count: number }[];
}

const emptyForm = (): FormState => ({
  name: '',
  categoryId: '',
  description: '',
  address: '',
  zone: '',
  phone: '',
  whatsapp: '',
  latitude: 0,
  longitude: 0,
  priceRange: '$',
  rating: 4,
  verified: false,
  featured: false,
  photoUrls: '',
  promoText: '',
  promoStart: '',
  promoEnd: '',
  email: '',
  website: '',
  instagram: '',
  facebook: '',
  serviciosText: '',
  tagsText: '',
  delivery: false,
  deliveryZonesText: '',
  deliveryFee: 0,
  minOrder: 0,
  paymentMethodsText: '',
  promosText: '',
  viewsCount: 0,
  reviewCount: 0,
});

type SortMode = 'name' | 'rating' | 'createdAt';

@Component({
  selector: 'lm-admin',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(true);

  readonly businesses = signal<Business[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly stats = signal<Stats | null>(null);
  readonly editing = signal<FormState | null>(null);
  readonly saving = signal(false);

  readonly adminPaymentDropdownOpen = signal(false);
  readonly adminCustomPaymentInput = signal('');
  readonly standardPaymentOptions = [
    { id: 'efectivo', label: 'Efectivo', icon: '💵', desc: 'Pago en efectivo' },
    { id: 'tarjeta', label: 'Tarjeta de crédito / débito', icon: '💳', desc: 'Tarjetas de crédito o débito' },
    { id: 'transferencia', label: 'Transferencia bancaria', icon: '🏦', desc: 'Transferencias y depósitos' },
    { id: 'contra_entrega', label: 'Pago contra entrega', icon: '📦', desc: 'Cobro al momento de entregar' },
    { id: 'billetera', label: 'Billetera digital', icon: '📱', desc: 'Tigo Money y billeteras' },
    { id: 'credito', label: 'Crédito local', icon: '🤝', desc: 'Fiado o crédito' },
    { id: 'cheque', label: 'Cheque', icon: '📝', desc: 'Cheque bancario' },
  ];

  readonly phoneError = signal('');
  readonly whatsappError = signal('');
  readonly emailError = signal('');

  readonly websiteError = signal('');

  readonly search = signal('');
  readonly activeOnly = signal(false);
  readonly sortBy = signal<SortMode>('name');

  readonly showReviews = signal(false);
  readonly reviews = signal<Review[]>([]);
  readonly reviewFilter = signal<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  readonly selectedReviewBusiness = signal<string>('all');
  readonly reviewMsg = signal('');
  readonly reviewLoading = signal(false);

  readonly selectedBusinessName = computed(() => {
    const id = this.selectedReviewBusiness();
    if (id === 'all') return 'Todos los negocios';
    return this.businessName(id);
  });

  readonly pendingReviews = computed(
    () => this.stats()?.pendingReviews ?? 0
  );

  readonly showPending = signal(false);
  readonly pendingMsg = signal('');
  readonly pendingLoading = signal(false);

  readonly pendingList = computed(() =>
    this.businesses().filter((b) => b.active === false)
  );

  readonly visibleBusinesses = computed(() => {
    const q = this.search().trim().toLowerCase();
    const onlyActive = this.activeOnly();
    const mode = this.sortBy();

    const list = this.businesses().filter((b) => {
      const matchActive = !onlyActive || b.active !== false;
      const matchQ =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q);
      return matchActive && matchQ;
    });

    return [...list].sort((a, b) => {
      if (mode === 'rating') return b.rating - a.rating;
      const da = a.createdAt;
      const db = b.createdAt;
      if (mode === 'createdAt' && da && db) return db > da ? 1 : -1;
      return a.name.localeCompare(b.name, 'es');
    });
  });

  ngOnInit() {
    if (!this.auth.authed() || this.auth.user()?.role !== 'admin') {
      this.router.navigate(['/login']);
      return;
    }
    this.load();
  }


  topCategories(): string {
    const s = this.stats();
    if (!s) return '';
    return s.byCategory
      .slice(0, 3)
      .map((c) => `${c.count} ${c._id}`)
      .join(' · ');
  }

  zonesSummary(): string {
    const s = this.stats();
    if (!s) return '';
    return s.zones.map((z) => `${z.count} ${z._id}`).join(' · ');
  }

  load() {
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.api.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
    this.api.businesses({ includeInactive: true }).subscribe((b) => {
      this.businesses.set(b);
      this.loading.set(false);
    });
    this.loadReviews();
  }

  loadReviews() {
    this.reviewLoading.set(true);
    this.api
      .adminReviews({
        businessId: this.selectedReviewBusiness(),
        status: this.reviewFilter(),
      })
      .subscribe({
        next: (r) => {
          this.reviews.set(r);
          this.reviewLoading.set(false);
        },
        error: () => {
          this.reviews.set([]);
          this.reviewLoading.set(false);
        },
      });
  }

  businessName(id: string): string {
    return this.businesses().find((b) => b._id === id || String(b._id) === String(id))?.name ?? id;
  }

  categoryName(id: string): string {
    return this.categories().find((c) => c._id === id)?.name ?? id;
  }

  toggleReviews() {
    this.showReviews.set(!this.showReviews());
    if (this.showReviews()) {
      this.reviewMsg.set('');
      this.loadReviews();
    }
  }

  setReviewFilter(f: 'pending' | 'approved' | 'rejected' | 'all') {
    this.reviewFilter.set(f);
    this.loadReviews();
  }

  setReviewBusiness(bizId: string) {
    this.selectedReviewBusiness.set(bizId);
    this.loadReviews();
  }

  openBusinessReviews(b: Business) {
    if (!b._id) return;
    this.selectedReviewBusiness.set(b._id);
    this.reviewFilter.set('all');
    this.showReviews.set(true);
    this.reviewMsg.set(`Visualizando comentarios de "${b.name}"`);
    this.loadReviews();
    setTimeout(() => {
      document.querySelector('.reviews-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  approveReview(r: Review) {
    this.reviewLoading.set(true);
    this.api.setReviewApproved(r._id, true).subscribe({
      next: () => {
        this.reviewLoading.set(false);
        this.reviewMsg.set(`Comentario de "${r.userName}" aprobado y publicado exitosamente.`);
        this.loadReviews();
        this.refreshStats();
      },
      error: (e) => {
        this.reviewLoading.set(false);
        this.reviewMsg.set(e.error?.message || 'Error al aprobar');
      },
    });
  }

  rejectReview(r: Review) {
    this.reviewLoading.set(true);
    this.api.rejectReview(r._id).subscribe({
      next: () => {
        this.reviewLoading.set(false);
        this.reviewMsg.set(`Comentario de "${r.userName}" rechazado (no publicado).`);
        this.loadReviews();
        this.refreshStats();
      },
      error: (e) => {
        this.reviewLoading.set(false);
        this.reviewMsg.set(e.error?.message || 'Error al rechazar');
      },
    });
  }

  deleteReview(r: Review) {
    if (!confirm(`¿Eliminar definitivamente el comentario de "${r.userName}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.reviewLoading.set(true);
    this.api.deleteReview(r._id).subscribe({
      next: () => {
        this.reviewLoading.set(false);
        this.reviewMsg.set('Comentario eliminado permanentemente.');
        this.loadReviews();
        this.refreshStats();
      },
      error: (e) => {
        this.reviewLoading.set(false);
        this.reviewMsg.set(e.error?.message || 'Error al eliminar');
      },
    });
  }

  refreshStats() {
    this.api.stats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  togglePending() {
    this.showPending.set(!this.showPending());
    this.pendingMsg.set('');
  }

  approvePending(b: Business) {
    if (!b._id) return;
    this.pendingLoading.set(true);
    this.pendingMsg.set('');
    this.api.approveBusiness(b._id).subscribe({
      next: () => {
        this.pendingLoading.set(false);
        this.pendingMsg.set(`"${b.name}" aprobado y publicado. Ya puede entrar el dueño.`);
        this.load();
      },
      error: (e) => {
        this.pendingLoading.set(false);
        this.pendingMsg.set(e?.error?.message || 'Error al aprobar');
      },
    });
  }

  rejectPending(b: Business) {
    if (!b._id) return;
    this.pendingLoading.set(true);
    this.pendingMsg.set('');
    this.api.rejectBusiness(b._id).subscribe({
      next: () => {
        this.pendingLoading.set(false);
        this.pendingMsg.set(`Solicitud de "${b.name}" rechazada y eliminada.`);
        this.load();
      },
      error: (e) => {
        this.pendingLoading.set(false);
        this.pendingMsg.set(e?.error?.message || 'Error al rechazar');
      },
    });
  }

  toggleAdminPayment(method: string) {
    const f = this.editing();
    if (!f) return;
    const current = textToList(f.paymentMethodsText);
    const exists = current.some((m) => m.toLowerCase() === method.toLowerCase());
    const next = exists
      ? current.filter((m) => m.toLowerCase() !== method.toLowerCase())
      : [...current, method];
    f.paymentMethodsText = listToText(next);
  }

  isAdminPaymentSelected(method: string): boolean {
    const f = this.editing();
    if (!f) return false;
    return textToList(f.paymentMethodsText).some(
      (m) => m.toLowerCase() === method.toLowerCase()
    );
  }

  addAdminCustomPayment() {
    const val = this.adminCustomPaymentInput().trim();
    if (!val) return;
    this.toggleAdminPayment(val);
    this.adminCustomPaymentInput.set('');
  }

  removeAdminPayment(method: string) {
    const f = this.editing();
    if (!f) return;
    const next = textToList(f.paymentMethodsText).filter((m) => m.toLowerCase() !== method.toLowerCase());
    f.paymentMethodsText = listToText(next);
  }

  adminSelectedPayments(): string[] {
    const f = this.editing();
    if (!f) return [];
    return textToList(f.paymentMethodsText);
  }

  getAdminPaymentIcon(method: string): string {
    const found = this.standardPaymentOptions.find(
      (o) => o.label.toLowerCase() === method.toLowerCase() || o.id.toLowerCase() === method.toLowerCase()
    );
    return found?.icon || '💳';
  }


  private clearContactErrors() {
    this.phoneError.set('');
    this.whatsappError.set('');
    this.emailError.set('');
    this.websiteError.set('');
  }

  newBusiness() {
    this.clearContactErrors();
    this.editing.set(emptyForm());
  }

  editBusiness(b: Business) {
    this.clearContactErrors();
    this.editing.set({
      _id: b._id,
      name: b.name,
      categoryId: b.categoryId,
      description: b.description,
      address: b.address,
      zone: b.zone ?? '',
      phone: b.phone,
      whatsapp: b.whatsapp,
      latitude: b.latitude,
      longitude: b.longitude,
      priceRange: b.priceRange,
      rating: b.rating,
      verified: b.verified,
      featured: b.featured,
      photoUrls: (b.photoUrls ?? []).join('\n'),
      promoText: b.promoText ?? '',
      promoStart: b.promoStart ?? '',
      promoEnd: b.promoEnd ?? '',
      email: b.email ?? '',
      website: b.website ?? '',
      instagram: b.instagram ?? '',
      facebook: b.facebook ?? '',
      serviciosText: listToText(b.servicios),
      tagsText: listToText(b.tags),
      delivery: b.delivery ?? false,
      deliveryZonesText: listToText(b.deliveryZones),
      deliveryFee: b.deliveryFee ?? 0,
      minOrder: b.minOrder ?? 0,
      paymentMethodsText: listToText(b.paymentMethods),
      promosText: promosToText(b.promos),
      viewsCount: b.viewsCount ?? 0,
      reviewCount: b.reviewCount ?? 0,
    });
  }

  cancelEdit() {
    this.clearContactErrors();
    this.editing.set(null);
    this.error.set('');
  }

  @HostListener('window:keydown.escape')
  onEscapePress() {
    if (this.editing()) {
      this.cancelEdit();
    }
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancelEdit();
    }
  }

  onPhoneInput(raw: string) {
    const cleaned = cleanPhoneInput(raw);
    if (this.editing()) this.editing()!.phone = cleaned;
    const v = validatePhone(cleaned, false);
    this.phoneError.set(v.valid ? '' : (v.error || ''));
  }

  onWhatsAppInput(raw: string) {
    const cleaned = cleanWhatsAppInput(raw);
    if (this.editing()) this.editing()!.whatsapp = cleaned;
    const v = validateWhatsApp(cleaned, false);
    this.whatsappError.set(v.valid ? '' : (v.error || ''));
  }

  onEmailInput(raw: string) {
    const cleaned = cleanEmailInput(raw);
    if (this.editing()) this.editing()!.email = cleaned;
    const v = validateEmail(cleaned, false);
    this.emailError.set(v.valid ? '' : (v.error || ''));
  }

  onWebsiteInput(raw: string) {
    const cleaned = cleanWebsiteInput(raw);
    if (this.editing()) this.editing()!.website = cleaned;
    const v = validateWebsite(cleaned, false);
    this.websiteError.set(v.valid ? '' : (v.error || ''));
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  save() {
    const f = this.editing();
    if (!f) return;
    if (!f.name.trim() || !f.categoryId) {
      this.error.set('Nombre y categoría son obligatorios');
      return;
    }

    const phoneRes = validatePhone(f.phone, false);
    const waRes = validateWhatsApp(f.whatsapp, false);
    const emailRes = validateEmail(f.email, false);
    const webRes = validateWebsite(f.website, false);

    this.phoneError.set(phoneRes.valid ? '' : (phoneRes.error || ''));
    this.whatsappError.set(waRes.valid ? '' : (waRes.error || ''));
    this.emailError.set(emailRes.valid ? '' : (emailRes.error || ''));
    this.websiteError.set(webRes.valid ? '' : (webRes.error || ''));

    if (!phoneRes.valid || !waRes.valid || !emailRes.valid || !webRes.valid) {
      this.error.set('Por favor corrige los datos de contacto con formato incorrecto');
      return;
    }

    const body = {
      _id: f._id,
      name: f.name.trim(),
      categoryId: f.categoryId,
      description: f.description.trim(),
      address: f.address.trim(),
      zone: f.zone.trim(),
      phone: f.phone.trim(),
      whatsapp: f.whatsapp.trim(),
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      priceRange: f.priceRange.trim(),
      rating: Number(f.rating),
      verified: f.verified,
      featured: f.featured,
      photoUrls: f.photoUrls
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      promoText: f.promoText.trim(),
      promoStart: f.promoStart.trim(),
      promoEnd: f.promoEnd.trim(),
      email: f.email.trim(),
      website: normalizeWebsiteUrl(f.website.trim()),
      instagram: f.instagram.trim(),
      facebook: f.facebook.trim(),
      servicios: textToList(f.serviciosText),
      tags: textToList(f.tagsText),
      delivery: f.delivery,
      deliveryZones: textToList(f.deliveryZonesText),
      deliveryFee: Number(f.deliveryFee) || 0,
      minOrder: Number(f.minOrder) || 0,
      paymentMethods: textToList(f.paymentMethodsText),
      promos: textToPromos(f.promosText),
      viewsCount: Number(f.viewsCount) || 0,
      reviewCount: Number(f.reviewCount) || 0,
    };
    delete body._id;

    this.saving.set(true);
    const req = f._id
      ? this.api.updateBusiness(f._id, body)
      : this.api.createBusiness(body);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.error.set('');
        this.editing.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.error?.message || 'Error al guardar');
      },
    });
  }

  /** Da de baja (desactiva) o reactiva un negocio. No se borra de la BD. */
  toggleActive(b: Business) {
    if (!b._id) return;
    this.saving.set(true);
    const req: Observable<unknown> = b.active
      ? this.api.deleteBusiness(b._id)
      : this.api.updateBusiness(b._id, { active: true });
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.error.set('');
        this.load();
      },
      error: (e: any) => {
        this.saving.set(false);
        this.error.set(e?.error?.message || 'Error al cambiar el estado');
      },
    });
  }

  toggleFeatured(b: Business) {
    if (!b._id) return;
    this.api
      .updateBusiness(b._id, { featured: !b.featured })
      .subscribe({
        next: () => this.load(),
        error: (e) => {
          this.error.set(e.error?.message || 'Error al cambiar el destacado');
        },
      });
  }
}