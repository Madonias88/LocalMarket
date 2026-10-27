import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import * as L from 'leaflet';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
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

/** Resultado de Nominatim para autocompletado. */
export interface GeoSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    suburb?: string;
    neighbourhood?: string;
  };
}

const MAP_MARKER_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
});

/** Registro público de un negocio: la ficha queda en revisión (admin aprueba). */
@Component({
  selector: 'lm-registro',
  imports: [RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  @ViewChild('locationMap', { read: ElementRef }) mapEl!: ElementRef<HTMLDivElement>;

  readonly categories = signal<Category[]>([]);
  readonly form = signal<RegistroForm>(emptyForm());
  readonly sending = signal(false);
  readonly done = signal<string | null>(null);
  readonly error = signal('');
  readonly step = signal(0);

  readonly phoneError = signal('');
  readonly whatsappError = signal('');
  readonly emailError = signal('');
  readonly websiteError = signal('');

  readonly steps = STEPS;

  readonly progress = computed(() => ((this.step() + 1) / STEPS.length) * 100);

  // ── Location / Map ─────────────────────────────────────────────
  private map?: L.Map;
  private marker?: L.Marker;

  readonly addressSuggestions = signal<GeoSuggestion[]>([]);
  readonly zoneSuggestions = signal<GeoSuggestion[]>([]);
  readonly showAddressSug = signal(false);
  readonly showZoneSug = signal(false);
  readonly geocoding = signal(false);
  readonly reverseGeocoding = signal(false);

  private addressDebounce?: ReturnType<typeof setTimeout>;
  private zoneDebounce?: ReturnType<typeof setTimeout>;
  private reverseGeocodeDebounce?: ReturnType<typeof setTimeout>;
  private nominatimBase = 'https://nominatim.openstreetmap.org';

  private get lat(): number { return parseFloat(this.form().latitude) || 0; }
  private get lng(): number { return parseFloat(this.form().longitude) || 0; }

  hasCoords(): boolean { return this.lat !== 0 || this.lng !== 0; }
  googleMapsUrl(): string { return `https://www.google.com/maps?q=${this.lat},${this.lng}`; }
  wazeUrl(): string { return `https://waze.com/ul?ll=${this.lat},${this.lng}&navigate=yes`; }

  ngOnInit() {
    this.api.categories().subscribe((c) => this.categories.set(c));
  }

  ngOnDestroy() {
    this.destroyMap();
    clearTimeout(this.addressDebounce);
    clearTimeout(this.zoneDebounce);
    clearTimeout(this.reverseGeocodeDebounce);
  }

  set(key: string, value: string | number) {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  parseNumber(value: unknown): number {
    return Number(value);
  }

  // ── Map ────────────────────────────────────────────────────────

  initLocationMap() {
    if (!this.mapEl?.nativeElement) return;
    if (this.map) {
      this.destroyMap();
    }

    const lat = this.lat || 14.6349;
    const lng = this.lng || -90.5069;
    const hasInitialCoords = this.lat !== 0 && this.lng !== 0;

    // Fix default icon paths safely without throwing TypeError
    try {
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
        shadowAnchor: [12, 41],
      });
    } catch {}

    this.map = L.map(this.mapEl.nativeElement, { scrollWheelZoom: false }).setView(
      [lat, lng],
      hasInitialCoords ? 16 : 13
    );

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.marker = L.marker([lat, lng], {
      icon: MAP_MARKER_ICON,
      draggable: true,
    }).addTo(this.map);

    this.setupMarkerEvents(this.marker);

    const initialPopup = hasInitialCoords && this.form().address
      ? `📍 <strong>${this.form().address}</strong>`
      : '📍 Haz clic en el mapa o arrastra el marcador para fijar tu ubicación';
    this.marker.bindPopup(initialPopup).openPopup();

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.applyLocation(e.latlng.lat, e.latlng.lng, true);
    });

    // Invalida tamaño en varios tiempos para sincronizar con la animación CSS de entrada
    setTimeout(() => this.map?.invalidateSize(), 50);
    setTimeout(() => this.map?.invalidateSize(), 200);
    setTimeout(() => this.map?.invalidateSize(), 400);
  }

  private setupMarkerEvents(marker: L.Marker) {
    marker.on('dragend', (e) => {
      const pos = (e.target as L.Marker).getLatLng();
      this.applyLocation(pos.lat, pos.lng, false);
    });
  }

  private destroyMap() {
    if (this.map) {
      try {
        this.map.remove();
      } catch {}
      this.map = undefined;
      this.marker = undefined;
    }
  }

  private applyLocation(lat: number, lng: number, pan = true, zoom?: number) {
    if (!this.map) return;

    if (!this.marker) {
      this.marker = L.marker([lat, lng], { icon: MAP_MARKER_ICON, draggable: true }).addTo(this.map);
      this.setupMarkerEvents(this.marker);
    } else {
      this.marker.setLatLng([lat, lng]);
    }

    if (zoom) {
      this.map.setView([lat, lng], zoom);
    } else if (pan) {
      this.map.panTo([lat, lng], { animate: true });
    }

    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);

    this.zone.run(() => {
      this.form.update((f) => ({
        ...f,
        latitude: latStr,
        longitude: lngStr,
      }));

      // Inmediata respuesta visual en el popup
      if (this.marker) {
        this.marker
          .bindPopup(
            `📍 <strong>Punto fijado</strong><br><small style="color:#0f766e">Lat: ${latStr}, Lng: ${lngStr}</small><br><span style="font-size:0.75rem;color:#64748b">Obteniendo dirección...</span>`
          )
          .openPopup();
      }

      this.reverseGeocode(lat, lng);
    });
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.error.set('Tu navegador no soporta geolocalización');
      return;
    }
    this.geocoding.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.zone.run(() => {
          this.geocoding.set(false);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.applyLocation(lat, lng, true, 16);
        });
      },
      (err) => {
        this.zone.run(() => {
          this.geocoding.set(false);
          this.error.set('No se pudo obtener la ubicación GPS: ' + (err.message || 'Permiso denegado'));
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ── Reverse Geocoding (Mapa -> Dirección automática) ────────────

  reverseGeocode(lat: number, lng: number) {
    clearTimeout(this.reverseGeocodeDebounce);
    this.reverseGeocodeDebounce = setTimeout(() => {
      this.reverseGeocoding.set(true);
      const url = `${this.nominatimBase}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      fetch(url, { headers: { 'Accept-Language': 'es' } })
        .then((r) => r.json())
        .then((data: any) => {
          this.zone.run(() => {
            this.reverseGeocoding.set(false);
            if (!data || data.error) {
              if (this.marker) {
                this.marker
                  .bindPopup(
                    `📍 <strong>Ubicación fijada en el mapa</strong><br><small style="color:#0f766e">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small>`
                  )
                  .openPopup();
              }
              return;
            }

            const addr = data.address || {};

            // Construir dirección legible
            let addressText = '';
            if (addr.road) {
              addressText = addr.road;
              if (addr.house_number) {
                addressText += ` ${addr.house_number}`;
              }
            } else if (addr.hamlet) {
              addressText = addr.hamlet;
            } else if (data.name && data.name !== data.display_name) {
              addressText = data.name;
            } else if (data.display_name) {
              const segments = data.display_name.split(',').map((s: string) => s.trim());
              addressText = segments.slice(0, 2).join(', ');
            }

            // Construir zona / municipio (en Guatemala, quarter suele ser Zona 1, Zona 2, etc.)
            const quarter = addr.quarter || '';
            const zoneCandidate = quarter || addr.suburb || addr.neighbourhood || addr.city_district || addr.hamlet || '';
            const muniCandidate = addr.town || addr.village || addr.city || addr.municipality || addr.county || '';

            let zoneText = '';
            if (zoneCandidate && muniCandidate && zoneCandidate !== muniCandidate) {
              zoneText = `${zoneCandidate}, ${muniCandidate}`;
            } else {
              zoneText = zoneCandidate || muniCandidate;
            }

            this.form.update((f) => ({
              ...f,
              address: addressText || f.address,
              zone: zoneText || f.zone,
            }));

            if (this.marker) {
              const popupContent = addressText
                ? `📍 <strong>${addressText}</strong>${zoneText ? `<br><small style="color:#0f766e">${zoneText}</small>` : ''}`
                : `📍 <strong>Ubicación fijada</strong><br><small style="color:#0f766e">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small>`;
              this.marker.bindPopup(popupContent).openPopup();
            }
          });
        })
        .catch(() => {
          this.zone.run(() => {
            this.reverseGeocoding.set(false);
            if (this.marker) {
              this.marker
                .bindPopup(
                  `📍 <strong>Ubicación fijada en el mapa</strong><br><small style="color:#0f766e">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small>`
                )
                .openPopup();
            }
          });
        });
    }, 250);
  }

  onCoordsChange(key: 'latitude' | 'longitude', val: string) {
    this.form.update(f => ({ ...f, [key]: val }));
    const lat = parseFloat(key === 'latitude' ? val : this.form().latitude);
    const lng = parseFloat(key === 'longitude' ? val : this.form().longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      this.applyLocation(lat, lng, true, 16);
    }
  }

  // ── Geocoding: dirección ──────────────────────────────────────

  onAddressInput(value: string) {
    this.form.update((f) => ({ ...f, address: value }));
    clearTimeout(this.addressDebounce);
    if (value.length < 3) { this.addressSuggestions.set([]); return; }
    this.addressDebounce = setTimeout(() => this.searchAddress(value), 450);
  }

  private searchAddress(q: string) {
    const url = `${this.nominatimBase}/search?format=json&addressdetails=1&limit=5&countrycodes=gt&q=${encodeURIComponent(q)}`;
    this.geocoding.set(true);
    fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then((r) => r.json())
      .then((results: GeoSuggestion[]) => {
        this.zone.run(() => {
          this.addressSuggestions.set(results ?? []);
          this.showAddressSug.set((results?.length ?? 0) > 0);
          this.geocoding.set(false);
        });
      })
      .catch(() => this.zone.run(() => this.geocoding.set(false)));
  }

  selectAddress(s: GeoSuggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    this.form.update((f) => ({
      ...f,
      address: s.display_name.split(',')[0],
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    this.addressSuggestions.set([]);
    this.showAddressSug.set(false);
    this.applyLocation(lat, lng, true, 16);
  }

  closeAddressSug() {
    setTimeout(() => this.zone.run(() => this.showAddressSug.set(false)), 250);
  }

  // ── Geocoding: zona / municipio ───────────────────────────────

  onZoneInput(value: string) {
    this.form.update((f) => ({ ...f, zone: value }));
    clearTimeout(this.zoneDebounce);
    if (value.length < 2) { this.zoneSuggestions.set([]); return; }
    this.zoneDebounce = setTimeout(() => this.searchZone(value), 450);
  }

  private searchZone(q: string) {
    const url = `${this.nominatimBase}/search?format=json&addressdetails=1&limit=5&countrycodes=gt&q=${encodeURIComponent(q)}`;
    fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then((r) => r.json())
      .then((results: GeoSuggestion[]) => {
        this.zone.run(() => {
          this.zoneSuggestions.set(results ?? []);
          this.showZoneSug.set((results?.length ?? 0) > 0);
        });
      })
      .catch(() => {});
  }

  selectZone(s: GeoSuggestion) {
    const parts = s.display_name.split(',').slice(0, 2).map((p) => p.trim());
    const label = parts.join(', ');
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    this.form.update((f) => ({
      ...f,
      zone: label,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    this.zoneSuggestions.set([]);
    this.showZoneSug.set(false);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.applyLocation(lat, lng, true, 14);
    }
  }

  closeZoneSug() {
    setTimeout(() => this.zone.run(() => this.showZoneSug.set(false)), 250);
  }

  private scheduleInitMap() {
    setTimeout(() => this.initLocationMap(), 60);
    setTimeout(() => this.initLocationMap(), 250);
  }

  onPhoneInput(raw: string) {
    const cleaned = cleanPhoneInput(raw);
    this.form.update(f => ({ ...f, phone: cleaned }));
    const v = validatePhone(cleaned, false);
    this.phoneError.set(v.valid ? '' : (v.error || ''));
  }

  onWhatsAppInput(raw: string) {
    const cleaned = cleanWhatsAppInput(raw);
    this.form.update(f => ({ ...f, whatsapp: cleaned }));
    const v = validateWhatsApp(cleaned, false);
    this.whatsappError.set(v.valid ? '' : (v.error || ''));
  }

  onEmailInput(raw: string) {
    const cleaned = cleanEmailInput(raw);
    this.form.update(f => ({ ...f, email: cleaned }));
    const v = validateEmail(cleaned, false);
    this.emailError.set(v.valid ? '' : (v.error || ''));
  }

  onWebsiteInput(raw: string) {
    const cleaned = cleanWebsiteInput(raw);
    this.form.update(f => ({ ...f, website: cleaned }));
    const v = validateWebsite(cleaned, false);
    this.websiteError.set(v.valid ? '' : (v.error || ''));
  }

  validateContactFields(): boolean {
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
      this.error.set('Por favor corrige los datos de contacto con formato incorrecto');
      return false;
    }

    if (!f.phone.trim() && !f.whatsapp.trim()) {
      this.error.set('Debes ingresar al menos un teléfono o WhatsApp de contacto');
      return false;
    }

    this.error.set('');
    return true;
  }

  nextStep() {
    this.error.set('');
    const f = this.form();

    if (this.step() === 0) {
      if (!f.name.trim()) { this.error.set('El nombre del negocio es obligatorio'); return; }
      if (!f.categoryId) { this.error.set('Selecciona una categoría'); return; }
    }

    if (this.step() === 2) {
      if (!this.validateContactFields()) return;
    }

    if (this.step() < STEPS.length - 1) {
      this.step.update(s => s + 1);
      if (this.step() === 1) {
        this.scheduleInitMap();
      }
    }
  }

  prevStep() {
    this.error.set('');
    if (this.step() > 0) {
      this.step.update(s => s - 1);
      if (this.step() === 1) {
        this.scheduleInitMap();
      }
    }
  }

  goToStep(i: number) {
    if (i < this.step()) {
      this.step.set(i);
      this.error.set('');
      if (i === 1) {
        this.scheduleInitMap();
      }
    }
  }

  submit() {
    const f = this.form();
    this.error.set('');
    const name = f.name.trim();

    if (!name) { this.error.set('El nombre del negocio es obligatorio'); return; }
    if (!f.categoryId) { this.error.set('Selecciona una categoría'); return; }
    if (!this.validateContactFields()) return;

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
        website: normalizeWebsiteUrl(f.website.trim()),
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