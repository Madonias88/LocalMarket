import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService, SessionUser } from '../../services/auth.service';
import { QrViewComponent } from '../../components/qr-view/qr-view';
import { listToText, textToList, promosToText, textToPromos } from '../../utils/lists';
import type { Business } from '../../models/business';

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

  readonly username = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly error = signal('');

  readonly activeTab = signal<Tab>('datos');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly savedMsg = signal('');
  readonly showQr = signal(false);

  readonly business = signal<Business | null>(null);
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
    if (this.auth.authed()) this.loadBusiness();
  }

  set<T>(key: keyof OwnerForm, value: T) {
    this.form.update((f) => ({ ...f, [key]: value }) as OwnerForm);
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  login() {
    this.api.login(this.username(), this.password()).subscribe({
      next: (r) => {
        this.auth.setSession(r);
        this.error.set('');
        this.loadBusiness();
      },
      error: () => this.error.set('Credenciales inválidas'),
    });
  }

  private loadBusiness() {
    const u = this.auth.user();
    if (!u?.businessId) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.business(u.businessId, true).subscribe({
      next: (b) => {
        this.business.set(b);
        this.form.set({
          name: b.name,
          description: b.description,
          address: b.address,
          zone: b.zone ?? '',
          phone: b.phone,
          whatsapp: b.whatsapp,
          latitude: b.latitude,
          longitude: b.longitude,
          priceRange: b.priceRange,
          photosText: (b.photoUrls ?? []).join('\n'),
          hoursText: hoursToText(b.hours),
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
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No encontramos tu negocio. Contacta al administrador.');
      },
    });
  }

  user(): SessionUser | null {
    return this.auth.user();
  }

  photos(): string[] {
    return textToList(this.form().photosText);
  }

  /** Tras subir/eliminar una foto, refresca negocio y textarea sin tocar el resto del formulario. */
  private applyPhotoSync(updated: Business) {
    this.business.set(updated);
    this.form.update((f) => ({ ...f, photosText: (updated.photoUrls ?? []).join('\n') }));
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    const u = this.auth.user();
    if (!u?.businessId) return;

    // Validación rápida en el cliente (mismas reglas que el servidor).
    const badFormat = files.filter((f) => !/^image\/(jpeg|png|webp)$/.test(f.type));
    const tooBig = files.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (badFormat.length) {
      this.error.set('Solo se admiten imágenes JPG, PNG o WebP');
      this.savedMsg.set('');
      input.value = '';
      return;
    }
    if (tooBig.length) {
      this.error.set(
        `La foto "${tooBig[0].name}" supera los 10 MB. Comprime la imagen o elige otra.`
      );
      this.savedMsg.set('');
      input.value = '';
      return;
    }
    if (files.length > 5) {
      this.error.set('Máximo 5 fotos por carga.');
      this.savedMsg.set('');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.error.set('');
    this.savedMsg.set('');

    let okCount = 0;
    const reasons: string[] = [];
    let queue: Promise<void> = Promise.resolve();
    for (const file of files) {
      queue = queue
        .then(() => firstValueFrom(this.api.uploadPhoto(u.businessId!, file)))
        .then((r) => {
          this.applyPhotoSync(r.business);
          okCount++;
        })
        .catch((e) => {
          const msg = e?.error?.message;
          if (msg && !reasons.includes(msg)) reasons.push(msg);
        });
    }
    queue.then(() => {
      this.uploading.set(false);
      input.value = '';
      if (reasons.length === 0) {
        this.savedMsg.set('Fotos subidas y visibles en tu ficha.');
      } else if (okCount === 0) {
        this.error.set(reasons[0] || 'No se pudieron subir las fotos.');
      } else {
        this.error.set(
          reasons[0]
            ? `${reasons[0]} Se subieron ${okCount} de ${files.length}.`
            : 'Algunas fotos no se subieron.'
        );
      }
    });
  }

  removePhoto(url: string) {
    const u = this.auth.user();
    if (!u?.businessId) return;
    this.api.removePhoto(u.businessId, url).subscribe({
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

    const u = this.auth.user();
    if (!u?.businessId) return;

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
      website: f.website.trim(),
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

    this.api.updateBusiness(u.businessId, body).subscribe({
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
    return ({ datos: 'Datos', horarios: 'Horarios', fotos: 'Fotos', promo: 'Promoción', extras: 'Extras' } as Record<string, string>)[t] ?? t;
  }

  selectTab(t: string) {
    this.activeTab.set(t as Tab);
  }
}