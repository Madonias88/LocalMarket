import { Injectable, signal } from '@angular/core';

export interface UserPosition {
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<UserPosition | null>(null);
  readonly unavailable = signal(false);

  request(): void {
    if (!('geolocation' in navigator)) {
      this.unavailable.set(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.position.set({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        this.unavailable.set(false);
      },
      () => {
        this.unavailable.set(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
}