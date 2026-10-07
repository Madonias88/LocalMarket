# Frontend LocalMarket (Angular 20)

SPA del directorio con Angular 20 + RxJS signals. Conecta con la API de
`backend/` (por defecto `http://localhost:3000/api` — ver `src/environments/`).

## Desarrollo

```bash
npm install
npm start        # http://localhost:4200 (ng serve --host 0.0.0.0 --port 4200)
```

## Tests

```bash
npm test         # Karma + Jasmine (utils: horarios, promociones, distancias + App)
```

## Páginas

- `/` — directorio: búsqueda, filtros por categoría/zona, "abierto ahora",
  "♥ Mis guardados" (localStorage), ordenar por cercanía/rating/nombre.
- `/negocio/:id` — ficha: galería, mapa Leaflet, reseñas, promociones, acciones
  (WhatsApp, Cómo llegar, Waze, Llamar, Compartir, Guardar) y **QR para imprimir**.
- `/promos` — promociones activas.
- `/mi-negocio` — panel del dueño (login, datos, horarios, fotos con multer, promos, QR de su ficha).
- `/admin` — panel del admin (stats, CRUD de negocios, moderación de reseñas).

## Notas

- El `apiUrl` se centraliza en `src/environments/environment.ts`
  (`environment.development.ts` para `ng serve`); el `angular.json` usa
  `fileReplacements` para el entorno correcto.
- En los templates no se usan conversiones globales (`Number`, `as`): los
  valores de formularios se leen con `$any($event.target)` y helpers como
  `parseNumber()`.
- Los favoritos se guardan en `localStorage` (`lm_favs`), sin cuenta.
- El QR se genera en el cliente con el paquete `qrcode` (sin servicios externos).