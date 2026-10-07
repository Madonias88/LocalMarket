import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { GeolocationService } from '../../services/geolocation.service';
import { distanceKm, formatDistance } from '../../utils/location';
import { isOpenNow } from '../../utils/open-hours';
import { activePromo } from '../../utils/promo';
import type { Business } from '../../models/business';

@Component({
  selector: 'lm-promos',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './promos.html',
  styleUrl: './promos.css',
})
export class PromosPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly geo = inject(GeolocationService);

  readonly loading = signal(true);
  readonly businesses = signal<Business[]>([]);

  private readonly userPos = this.geo.position;

  readonly withPromos = computed(() =>
    this.businesses()
      .filter((b) => activePromo(b))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  );

  ngOnInit() {
    this.api.businesses().subscribe((b) => {
      this.businesses.set(b);
      this.loading.set(false);
    });
    this.geo.request();
  }

  distanceOf(b: Business): number {
    const pos = this.userPos();
    if (!pos) return Number.POSITIVE_INFINITY;
    return distanceKm(pos.latitude, pos.longitude, b.latitude, b.longitude);
  }

  distanceLabel(b: Business): string {
    return formatDistance(this.distanceOf(b));
  }

  openLabel(b: Business): string {
    return isOpenNow(b.hours) ? 'Abierto' : 'Cerrado';
  }

  isOpen(b: Business): boolean {
    return isOpenNow(b.hours);
  }
}