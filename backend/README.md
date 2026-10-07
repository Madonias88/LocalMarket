# LocalMarket Backend (Express + MongoDB + Node)

API REST del directorio. Arranca en `http://localhost:3000` y sirve también las
fotos subidas en `/uploads`.

## Comandos

```bash
npm install       # instala dependencias
npm run seed      # carga datos de ejemplo (idempotente)
npm start         # API en :3000
npm run dev       # nodo en modo watch
npm test          # smoke tests (node:test) — requiere el server encendido
```

## Configuración (`backend/.env`)

```ini
MONGODB_URI=mongodb://127.0.0.1:27017/localmarket
JWT_SECRET=<clave secreta>
ADMIN_USER=admin
ADMIN_PASSWORD=admin123
PORT=3000
```

El archivo `.env` **siempre gana** sobre variables del sistema: `server.js` y
`seed.js` llaman `dotenv` con `config({ override: true })`.

## Endpoints principales

| Método | Ruta                          | Acceso   | Descripción                              |
| ------ | ----------------------------- | -------- | ---------------------------------------- |
| GET    | `/api/businesses`             | público  | Lista (filtros `category`, `q`, `includeInactive`) |
| GET    | `/api/businesses/:id`         | público  | Detalle                                  |
| GET    | `/api/businesses/stats`       | admin    | Estadísticas por categoría/zona, dueños  |
| POST   | `/api/businesses`             | admin    | Crear negocio                            |
| PUT    | `/api/businesses/:id`         | owner/admin | Editar negocio (owner solo el suyo)   |
| DELETE | `/api/businesses/:id`         | admin    | Desactivar negocio                       |
| POST   | `/api/businesses/:id/photos`  | owner/admin | Subir fotos (multer, campo `photos`)  |
| DELETE | `/api/businesses/:id/photos`  | owner/admin | Borrar una foto (`{ url }`)           |
| GET    | `/api/categories`             | público  | Categorías                               |
| GET    | `/api/reviews/:businessId`    | público  | Reseñas aprobadas                        |
| POST   | `/api/reviews/:businessId`    | público  | Crear reseña (moderación)                |
| GET    | `/api/reviews/admin/list`     | admin    | Moderación                               |
| PUT    | `/api/reviews/:id`            | admin    | Aprobar/rechazar reseña                  |
| DELETE | `/api/reviews/:id`            | admin    | Eliminar reseña                          |
| POST   | `/api/auth/login`             | público  | Login unificado (admin y dueños)         |

## Permisos y seguridad

- JWT firmado con `JWT_SECRET` del entorno; el dueño está vinculado a su
  negocio con `username + businessId + role: owner + active`. Un dueño **no**
  puede tocar el negocio de otro.
- `multer` valida tipo (JPG/PNG/WebP) y tamaño (10 MB, 5 por carga) y genera el nombre del
  archivo en el servidor.
- `helmet`, `cors` y `express-rate-limit` activos.
- Los errores internos devuelven mensajes genéricos (el detalle queda en el log).

## Tests

`npm test` ejecuta `node --test test/` (node:test + fetch, sin dependencias).
Necesitan: backend encendido en `:3000` y datos del seed. Cubren listado,
login admin/dueño, permisos por rol y por dueño.