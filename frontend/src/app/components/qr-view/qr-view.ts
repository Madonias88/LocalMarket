import { Component, Input, OnChanges, signal } from '@angular/core';
import QRCode from 'qrcode';

/**
 * Muestra un codigo QR (data URL generado en el cliente, sin servicios externos)
 * a partir del valor recibido. Pensado para imprimir y pegar en el local.
 */
@Component({
  selector: 'lm-qr-view',
  standalone: true,
  imports: [],
  templateUrl: './qr-view.html',
  styleUrl: './qr-view.css',
})
export class QrViewComponent implements OnChanges {
  @Input() value = '';

  readonly dataUrl = signal('');

  ngOnChanges(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    if (!this.value) {
      this.dataUrl.set('');
      return;
    }
    try {
      this.dataUrl.set(
        await QRCode.toDataURL(this.value, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      );
    } catch {
      this.dataUrl.set('');
    }
  }
}