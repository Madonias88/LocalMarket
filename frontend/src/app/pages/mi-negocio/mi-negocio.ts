import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService, SessionUser } from '../../services/auth.service';
import { QrViewComponent } from '../../components/qr-view/qr-view';
import { listToText, textToList, promosToText, textToPromos } from '../../utils/lists';
import {
  PRICE_RANGE_OPTIONS,
  PriceRangeOption,
  getPriceRangeOption,
} from '../../utils/price-range';
import {
  ScheduleMode,
  DayRow,
  WeekdayWeekendConfig,
  DEFAULT_WEEKDAYS_WEEKEND,
  createDefaultDays,
  weekdayWeekendToText,
  daysToText,
  parseScheduleText,
  SCHEDULE_PRESETS,
  SchedulePreset,
} from '../../utils/schedule-helpers';
import { isOpenNow } from '../../utils/open-hours';
import type { Business } from '../../models/business';
import type { Category } from '../../models/category';
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

interface OwnerForm {
  name: string;
  description: string;
  address: string;
  zone: string;
  phone: string;
  whatsapp: string;
  latitude: number;
  longitude: number;
  priceRange: string;
  photosText: string;
  hoursText: string;
  promoText: string;
  promoStart: string;
  promoEnd: string;
  // --- Extras ---
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
}

type Tab = 'datos' | 'horarios' | 'fotos' | 'promo' | 'extras';
type ViewMode = 'grid' | 'edit';

/** Límite de tamaño por foto (debe coincidir con el del backend). */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function hoursToText(hours: Record<string, string> | undefined): string {
  return Object.entries(hours ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function textToHours(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}

@Component({
  selector: 'lm-mi-negocio',
  imports: [FormsModule, RouterLink, QrViewComponent],
  templateUrl: './mi-negocio.html',
  styleUrl: './mi-negocio.css',
})
export class MiNegocioPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');

  readonly viewMode = signal<ViewMode>('grid');
  readonly myBusinesses = signal<Business[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly activeTab = signal<Tab>('datos');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly uploadingCount = signal(0);
  readonly uploadProgress = signal(0);
  readonly savedMsg = signal('');
  readonly showQr = signal(false);

  readonly business = signal<Business | null>(null);

  readonly priceOptions = PRICE_RANGE_OPTIONS;
  readonly schedulePresets = SCHEDULE_PRESETS;
  readonly scheduleMode = signal<ScheduleMode>('weekdays-weekend');
  readonly weekdaysConfig = signal<WeekdayWeekendConfig>({ ...DEFAULT_WEEKDAYS_WEEKEND });
  readonly daysConfig = signal<DayRow[]>(createDefaultDays());

  readonly previewImageModalUrl = signal<string | null>(null);

  readonly availablePaymentOptions = [
    { id: 'efectivo', label: 'Efectivo', icon: '💵', desc: 'Pago en efectivo (Quetzales)' },
    { id: 'tarjeta', label: 'Tarjeta de crédito / débito', icon: '💳', desc: 'Visa, Mastercard u otras' },
    { id: 'transferencia', label: 'Transferencia bancaria', icon: '🏦', desc: 'Depósito o transferencia bancaria' },
    { id: 'contra_entrega', label: 'Pago contra entrega', icon: '📦', desc: 'Pago al momento de recibir el pedido' },
    { id: 'billetera', label: 'Billetera digital', icon: '📱', desc: 'Tigo Money y pagos móviles' },
    { id: 'credito', label: 'Crédito local / Fiado', icon: '🤝', desc: 'Para clientes de confianza' },
    { id: 'cheque', label: 'Cheque', icon: '📝', desc: 'Cheque local' },
  ];

  readonly paymentMethodsOpen = signal(false);
  readonly customPaymentInput = signal('');


  readonly phoneError = signal('');
  readonly whatsappError = signal('');
  readonly emailError = signal('');
  readonly websiteError = signal('');

  readonly form = signal<OwnerForm>({
    name: '',
    description: '',
    address: '',
    zone: '',
    phone: '',
    whatsapp: '',
    latitude: 0,
    longitude: 0,
    priceRange: '$',
    photosText: '',
    hoursText: '',
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
  });

  ngOnInit() {
    if (!this.auth.authed()) {
      this.router.navigate(['/login']);
      return;
    }
    this.api.categories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
    this.loadMyBusinesses();
  }

  set<T>(key: keyof OwnerForm, value: T) {
    this.form.update((f) => ({ ...f, [key]: value }) as OwnerForm);
  }

  onPhoneChange(raw: string) {
    const cleaned = cleanPhoneInput(raw);
    this.set('phone', cleaned);
    const v = validatePhone(cleaned, false);
    this.phoneError.set(v.valid ? '' : (v.error || ''));
  }

  onWhatsAppChange(raw: string) {
    const cleaned = cleanWhatsAppInput(raw);
    this.set('whatsapp', cleaned);
    const v = validateWhatsApp(cleaned, false);
    this.whatsappError.set(v.valid ? '' : (v.error || ''));
  }

  onEmailChange(raw: string) {
    const cleaned = cleanEmailInput(raw);
    this.set('email', cleaned);
    const v = validateEmail(cleaned, false);
    this.emailError.set(v.valid ? '' : (v.error || ''));
  }

  onWebsiteChange(raw: string) {
    const cleaned = cleanWebsiteInput(raw);
    this.set('website', cleaned);
    const v = validateWebsite(cleaned, false);
    this.websiteError.set(v.valid ? '' : (v.error || ''));
  }

  validateContacts(): boolean {
    const f = this.form();
    const phoneRes = validatePhone(f.phone, false);
    const waRes = validateWhatsApp(f.whatsapp, false);
    const emailRes = validateEmail(f.email, false);
    const webRes = validateWebsite(f.website, false);

    this.phoneError.set(phoneRes.valid ? '' : (phoneRes.error || ''));
    this.whatsappError.set(waRes.valid ? '' : (waRes.error || ''));
    this.emailError.set(emailRes.valid ? '' : (emailRes.error || ''));
    this.websiteError.set(webRes.valid ? '' : (webRes.error || ''));

    if (!phoneRes.valid || !waRes.valid || !emailRes.valid || !webRes.valid) {
      this.error.set('Por favor corrige los campos de contacto señalados');
      return false;
    }
    return true;
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  // --- MÉTODOS DE PAGO (LISTA EMERGENTE) ---
  readonly selectedPaymentMethods = computed(() => {
    return textToList(this.form().paymentMethodsText);
  });

  togglePaymentDropdown() {
    this.paymentMethodsOpen.set(!this.paymentMethodsOpen());
  }

  isPaymentSelected(label: string): boolean {
    return this.selectedPaymentMethods().some(
      (m) => m.toLowerCase() === label.toLowerCase()
    );
  }

  togglePaymentMethod(label: string) {
    const current = this.selectedPaymentMethods();
    const exists = current.some((m) => m.toLowerCase() === label.toLowerCase());
    const next = exists
      ? current.filter((m) => m.toLowerCase() !== label.toLowerCase())
      : [...current, label];
    this.set('paymentMethodsText', listToText(next));
  }

  removePaymentMethod(method: string) {
    const current = this.selectedPaymentMethods();
    const next = current.filter((m) => m.toLowerCase() !== method.toLowerCase());
    this.set('paymentMethodsText', listToText(next));
  }

  addCustomPaymentMethod() {
    const val = this.customPaymentInput().trim();
    if (!val) return;
    this.togglePaymentMethod(val);
    this.customPaymentInput.set('');
  }

  getPaymentIcon(method: string): string {
    const found = this.availablePaymentOptions.find(
      (o) => o.label.toLowerCase() === method.toLowerCase() || o.id.toLowerCase() === method.toLowerCase()
    );
    return found?.icon || '💳';
  }

  loadMyBusinesses() {


    this.loading.set(true);
    this.error.set('');
    this.api.myBusinesses().subscribe({
      next: (list) => {
        this.myBusinesses.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No pudimos cargar tus negocios.');
      },
    });
  }

  selectBusiness(b: Business) {
    this.business.set(b);
    this.savedMsg.set('');
    this.error.set('');
    const rawHours = hoursToText(b.hours);
    const parsedSchedule = parseScheduleText(rawHours);
    this.scheduleMode.set(parsedSchedule.mode);
    this.weekdaysConfig.set(parsedSchedule.weekdaysConfig);
    this.daysConfig.set(parsedSchedule.days);

    this.form.set({
      name: b.name,
      description: b.description,
      address: b.address,
      zone: b.zone ?? '',
      phone: b.phone,
      whatsapp: b.whatsapp,
      latitude: b.latitude,
      longitude: b.longitude,
      priceRange: b.priceRange || '$',
      photosText: (b.photoUrls ?? []).join('\n'),
      hoursText: rawHours,
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
    });
    this.viewMode.set('edit');
  }

  backToGrid() {
    this.viewMode.set('grid');
    this.loadMyBusinesses();
  }

  getCategoryName(catId: string): string {
    const cat = this.categories().find((c) => c._id === catId);
    return cat ? cat.name : 'Negocio';
  }

  user(): SessionUser | null {
    return this.auth.user();
  }

  photos(): string[] {
    return textToList(this.form().photosText);
  }

  mainPhoto(): string {
    return this.photos()[0] || '';
  }

  additionalPhotos(): string[] {
    return this.photos().slice(1);
  }

  openImagePreview(url: string) {
    this.previewImageModalUrl.set(url);
  }

  closeImagePreview() {
    this.previewImageModalUrl.set(null);
  }

  /** Tras subir/eliminar una foto, refresca negocio y textarea sin tocar el resto del formulario. */
  private applyPhotoSync(updated: Business) {
    this.business.set(updated);
    this.form.update((f) => ({ ...f, photosText: (updated.photoUrls ?? []).join('\n') }));
  }

  onMainPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.uploadFiles(files, true);
    input.value = '';
  }

  onAdditionalFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.uploadFiles(files, false);
    input.value = '';
  }

  onDropAdditional(event: DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;
    this.uploadFiles(files, false);
  }

  makeMainPhoto(url: string) {
    const current = this.photos();
    if (!current.includes(url) || current[0] === url) return;
    const reordered = [url, ...current.filter((u) => u !== url)];
    this.form.update((f) => ({ ...f, photosText: reordered.join('\n') }));
    const b = this.business();
    if (b?._id) {
      this.api.updateBusiness(b._id, { photoUrls: reordered }).subscribe({
        next: (updated) => {
          this.applyPhotoSync(updated);
          this.savedMsg.set('Foto establecida como imagen principal.');
        },
        error: (e) => this.error.set(e?.error?.message || 'Error al actualizar foto principal'),
      });
    }
  }

  moveAdditionalPhoto(indexInAdditional: number, direction: 'up' | 'down') {
    const additional = [...this.additionalPhotos()];
    const targetIdx = direction === 'up' ? indexInAdditional - 1 : indexInAdditional + 1;
    if (targetIdx < 0 || targetIdx >= additional.length) return;
    const temp = additional[indexInAdditional];
    additional[indexInAdditional] = additional[targetIdx];
    additional[targetIdx] = temp;
    const main = this.mainPhoto();
    const reordered = main ? [main, ...additional] : additional;
    this.form.update((f) => ({ ...f, photosText: reordered.join('\n') }));
    const b = this.business();
    if (b?._id) {
      this.api.updateBusiness(b._id, { photoUrls: reordered }).subscribe({
        next: (updated) => {
          this.applyPhotoSync(updated);
        },
      });
    }
  }

  private uploadFiles(files: File[], isMain: boolean = false) {
    const b = this.business();
    if (!b?._id) return;

    const badFormat = files.filter((f) => !/^image\/(jpeg|png|webp)$/.test(f.type));
    const tooBig = files.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (badFormat.length) {
      this.error.set('Solo se admiten imágenes JPG, PNG o WebP');
      this.savedMsg.set('');
      return;
    }
    if (tooBig.length) {
      this.error.set(`La foto "${tooBig[0].name}" supera los 10 MB. Comprime la imagen o elige otra.`);
      this.savedMsg.set('');
      return;
    }
    if (files.length > 5) {
      this.error.set('Máximo 5 fotos por carga.');
      this.savedMsg.set('');
      return;
    }

    this.uploading.set(true);
    this.uploadingCount.set(files.length);
    this.uploadProgress.set(0);
    this.error.set('');
    this.savedMsg.set('');

    let okCount = 0;
    let doneCount = 0;
    const reasons: string[] = [];
    let queue: Promise<void> = Promise.resolve();
    for (const file of files) {
      queue = queue
        .then(() => firstValueFrom(this.api.uploadPhoto(b._id!, file)))
        .then(async (r) => {
          okCount++;
          if (isMain) {
            const allUrls = r.business?.photoUrls || r.photoUrls || [];
            const newlyUploaded = allUrls[allUrls.length - 1];
            if (newlyUploaded) {
              const reordered = [newlyUploaded, ...allUrls.filter((u: string) => u !== newlyUploaded)];
              const up = await firstValueFrom(this.api.updateBusiness(b._id!, { photoUrls: reordered }));
              this.applyPhotoSync(up);
              return;
            }
          }
          this.applyPhotoSync(r.business);
        })
        .catch((e) => {
          const msg = e?.error?.message;
          if (msg && !reasons.includes(msg)) reasons.push(msg);
        })
        .finally(() => {
          doneCount++;
          this.uploadProgress.set(Math.round((doneCount / files.length) * 100));
        });
    }
    queue.then(() => {
      this.uploading.set(false);
      this.uploadProgress.set(0);
      if (reasons.length === 0) {
        this.savedMsg.set(
          isMain
            ? 'Foto principal actualizada correctamente.'
            : `${okCount} foto${okCount !== 1 ? 's' : ''} subida${okCount !== 1 ? 's' : ''} correctamente.`
        );
      } else if (okCount === 0) {
        this.error.set(reasons[0] || 'No se pudieron subir las fotos.');
      } else {
        this.error.set(reasons[0] ? `${reasons[0]} Se subieron ${okCount} de ${files.length}.` : 'Algunas fotos no se subieron.');
      }
    });
  }


  removePhoto(url: string) {
    const b = this.business();
    if (!b?._id) return;
    this.api.removePhoto(b._id, url).subscribe({
      next: (r) => {
        this.applyPhotoSync(r.business);
        this.savedMsg.set('Foto eliminada.');
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo eliminar la foto'),
    });
  }

  toggleQr() {
    this.showQr.set(!this.showQr());
  }

  qrValue(): string {
    const b = this.business();
    return b?._id ? `${window.location.origin}/negocio/${b._id}` : '';
  }

  save() {
    const f = this.form();
    if (!f.name.trim()) {
      this.error.set('El nombre es obligatorio');
      return;
    }
    if (!this.validateContacts()) return;

    const b = this.business();
    if (!b?._id) return;

    this.saving.set(true);
    this.error.set('');
    this.savedMsg.set('');

    const body = {
      name: f.name.trim(),
      description: f.description.trim(),
      address: f.address.trim(),
      zone: f.zone.trim(),
      phone: f.phone.trim(),
      whatsapp: f.whatsapp.trim(),
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      priceRange: f.priceRange.trim(),
      photoUrls: textToList(f.photosText),
      hours: textToHours(f.hoursText),
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
    };

    this.api.updateBusiness(b._id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.savedMsg.set('Cambios guardados y visibles en el directorio.');
        this.business.set(updated);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e.error?.message || 'Error al guardar los cambios');
      },
    });
  }

  previewUrl(): string {
    const b = this.business();
    return b ? `/negocio/${b._id}` : '/';
  }

  tabLabel(t: string): string {
    return (
      {
        datos: 'Datos',
        horarios: 'Horarios',
        fotos: 'Fotos',
        promo: 'Promoción',
        extras: 'Extras',
      } as Record<string, string>
    )[t] ?? t;
  }


  selectTab(t: string) {
    this.activeTab.set(t as Tab);
  }

  currentPriceOption(): PriceRangeOption {
    return getPriceRangeOption(this.form().priceRange);
  }

  isOpenNowCalculated(): boolean {
    return isOpenNow(textToHours(this.form().hoursText));
  }

  setScheduleMode(mode: ScheduleMode) {
    this.scheduleMode.set(mode);
    if (mode === 'weekdays-weekend') {
      this.set('hoursText', weekdayWeekendToText(this.weekdaysConfig()));
    } else if (mode === 'daily') {
      this.set('hoursText', daysToText(this.daysConfig()));
    }
  }

  updateWeekdays<K extends keyof WeekdayWeekendConfig>(key: K, val: WeekdayWeekendConfig[K]) {
    this.weekdaysConfig.update((cfg) => {
      const updated = { ...cfg, [key]: val };
      if (this.scheduleMode() === 'weekdays-weekend') {
        this.set('hoursText', weekdayWeekendToText(updated));
      }
      return updated;
    });
  }

  updateDay(index: number, patch: Partial<DayRow>) {
    this.daysConfig.update((rows) => {
      const updated = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
      if (this.scheduleMode() === 'daily') {
        this.set('hoursText', daysToText(updated));
      }
      return updated;
    });
  }

  copyMondayToWeekdays() {
    const monday = this.daysConfig()[0];
    if (!monday) return;
    this.daysConfig.update((rows) => {
      const updated = rows.map((r, i) => {
        if (i >= 1 && i <= 4) {
          return {
            ...r,
            isOpen: monday.isOpen,
            isAppointment: monday.isAppointment,
            start: monday.start,
            end: monday.end,
          };
        }
        return r;
      });
      if (this.scheduleMode() === 'daily') {
        this.set('hoursText', daysToText(updated));
      }
      return updated;
    });
  }

  copyMondayToAll() {
    const monday = this.daysConfig()[0];
    if (!monday) return;
    this.daysConfig.update((rows) => {
      const updated = rows.map((r) => ({
        ...r,
        isOpen: monday.isOpen,
        isAppointment: monday.isAppointment,
        start: monday.start,
        end: monday.end,
      }));
      if (this.scheduleMode() === 'daily') {
        this.set('hoursText', daysToText(updated));
      }
      return updated;
    });
  }

  applyPreset(preset: SchedulePreset) {
    this.set('hoursText', preset.text);
    const p = parseScheduleText(preset.text);
    this.weekdaysConfig.set(p.weekdaysConfig);
    this.daysConfig.set(p.days);
    this.scheduleMode.set(p.mode);
  }

  onCustomHoursChange(text: string) {
    this.set('hoursText', text);
    const p = parseScheduleText(text);
    this.weekdaysConfig.set(p.weekdaysConfig);
    this.daysConfig.set(p.days);
  }
}