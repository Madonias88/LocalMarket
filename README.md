# LocalMarket v2

Directorio de negocios y emprendedores del área de San Raymundo, San Juan
Sacatepéquez, Ciudad Quetzal y Ciudad de Guatemala. Stack **MEAN**:

- **M**ongoDB — base local (`mongodb://127.0.0.1:27017/localmarket`)
- **E**xpress — API REST en `backend/` (Node.js)
- **A**ngular 20 — SPA en `frontend/`
- **N**ode v22 — runtime de ambos

Todo corre **100% local**; no hay despliegue (Atlas/Render/Netlify) en esta
versión.

## Requisitos

- Node.js 22+ y npm
- MongoDB en `127.0.0.1:27017`

## Puesta en marcha (dos terminales)

```bash
# 1) Backend (API en http://localhost:3000)
cd backend
npm install
npm run seed      # carga 20 negocios, 8 categorias, 21 usuarios y resenas de ejemplo
npm start

# 2) Frontend (web en http://localhost:4200)
cd frontend
npm install
npm start
```

> **Importante:** la API nunca se debe tomar de la variable de entorno
> `MONGODB_URI` del sistema operativo. La URI de MongoDB local se define en
> `backend/.env` y el arranque usa `dotenv` con `override: true` para que ese
> archivo siempre gane. Si tu PC tiene una variable `MONGODB_URI` de un
> proyecto anterior, elimínala (usuario):
>
> ```powershell
> [Environment]::SetEnvironmentVariable('MONGODB_URI', $null, 'User')
> ```

## Cuentas de demostración

| Rol   | Usuario                    | Contraseña |
| ----- | -------------------------- | ---------- |
| Admin | `admin`                    | `admin123` |
| Dueño | `comedor-mili-san-raymundo`| `owner123` |

El usuario de cada negocio es su **slug** (`_id`): por ejemplo
`comedor-mili-san-raymundo`, `sastreria-godoy-san-ray-mundo`, etc.
La contraseña de todos los dueños es `owner123`.

## Funcionalidades

**Visitantes**
- **Landing** moderna (`/`) con botones hacia el directorio, categorías y negocios destacados.
- **Registro de negocio** (`/registro`): formulario público con el que cualquier emprendedor deja su ficha y sus credenciales de acceso. El negocio queda **pendiente de aprobación** y la cuenta del dueño inactiva hasta que un administrador la publique.
- Directorio (`/negocios`) con búsqueda, filtro por categoría y zona, "abierto ahora" y ordenar por cercanía / calificación / nombre.
- Ficha por negocio: galería de fotos, mapa Leaflet, reseñas moderadas, horarios, promociones vigentes, servicios y etiquetas, contacto y redes (email, web, Instagram, Facebook), envío a domicilio y métodos de pago, popularidad (vistas y reseñas) y ofertas estructuradas con vigencia propia; botones WhatsApp / Cómo llegar / Waze / Llamar, **Compartir** (Web Share con fallback a WhatsApp) y **★ Guardar** (favoritos en `localStorage`).
- Página **Promociones** con las ofertas activas.
- **Código QR** por negocio (generado en el cliente con `qrcode`) para imprimir y pegar en el local.

**Dueño (`/mi-negocio`)**
- Login con su cuenta (usuario que eligió al registrarse; en el seed, usuario = slug del negocio).
- Solo puede entrar cuando su ficha ha sido **aprobada** por el administrador.
- Pestañas para editar datos, horarios, **subir/eliminar fotos reales** (multer → `backend/uploads/`, servidas en `/uploads`), publicar promociones con fechas y una pestaña **Extras** con contacto/redes, servicios y etiquetas, envío a domicilio, métodos de pago y ofertas estructuradas.
- Ver/descargar el **QR** de su ficha.

**Admin (`/admin`)**
- Estadísticas (totales, por categoría, por zona, dueños, reseñas pendientes).
- Botón **"Solicitudes (n)"**: lista los negocios registrados por el público que esperan aprobación. Cada uno se puede **Aprobar y publicar** (activa el negocio y la cuenta del dueño), **Editar** antes de aprobar o **Rechazar** (elimina ficha y cuenta).
- CRUD de negocios y moderación de reseñas (aprobar/rechazar/eliminar).

## Estructura

```
LocalMarketv2/
├─ backend/
│  ├─ server.js             # Express + estáticos (uploads) + dotenv override
│  ├─ seed.js               # datos de ejemplo (idempotente)
│  ├─ middleware/auth.js    # login unificado + JWT + requireAuth
│  ├─ routes/               # businesses (incl. filtros con operadores), reviews, categories
│  └─ test/smoke.test.mjs   # smoke tests de la API (node:test)
└─ frontend/
   └─ src/
      ├─ environments/      # apiUrl centralizado (environment.ts)
      ├─ app/
      │  ├─ pages/          # landing, registro, home (directorio), detail, promos, admin, mi-negocio
      │  ├─ services/       # api, auth, geolocation, favorites
      │  ├─ components/     # qr-view
      │  ├─ utils/          # open-hours, promo, location (+ specs)
      │  └─ models/         # Business, Review, Category, Stats, Auth
```

## Tests

```bash
cd backend
npm test          # smoke tests: pide el backend encendido en :3000 (node:test, sin dependencias)

cd frontend
npm test          # Karma (Jasmine): utils (horarios, promociones, distancias) + App
```

## Operadores de consulta en MongoDB

Siguiendo el documento *"Base de Datos Avanzado — MongoDB | Operadores de
Consulta"*, los operadores están aplicados **en la lógica del backend**: el
endpoint público `GET /api/businesses` traduce los filtros del directorio a
consultas reales con `Business.find(...)` sobre la colección `businesses`, y
el frontend solo consume la API y muestra los resultados como fichas.

En `/negocios`, el botón **"Filtros avanzados"** (sin login) agrupa los
controles; cada cambio dispara una petición que el backend resuelve con estos
operadores:

| Operador | Parámetro | Qué filtra |
| -------- | --------- | ---------- |
| `$gte` / `$lte` | `ratingMin` / `ratingMax` | rango de rating (juntos: consulta doble sobre el mismo campo) |
| `$in` | `price` | varias opciones de precio separadas por comas (`$,$$`) |
| `$eq` (implícito) | `featured`, `verified`, `delivery`, `category`, `zone` | destacados, verificados, negocios **con envío**, categoría y zona |
| `$exists` + `$ne` | `promo` | promociones no vacías (consulta doble) |
| `$size` | `fotos` | cantidad exacta de fotos |
| `$not { $size: 0 }` | `photos` | al menos una foto (combinada sobre arreglos) |
| `$or` de `$regex` | `q` | búsqueda de texto sobre nombre, descripción y dirección |

Combinar varios filtros equivale a un `$and` implícito (consultas dobles y
combinadas). Además `GET /api/businesses/zones` usa un `aggregate` con
`$group` + `$sum` para listar las zonas disponibles públicamente.

Los documentos de negocio también incluyen campos enriquecidos que habilitan
operadores de arreglos y combinados: `servicios[]` y `tags[]` (`$all`, `$in`,
`$size`), `paymentMethods[]` y `deliveryZones[]`, `openingHours[]` con
`{dia, abre, cierra, cerrado}` y `promos[]` con `{titulo, descuento, desde,
hasta}` (`$elemMatch`), además de contacto/redes (`email`, `website`,
`instagram`, `facebook`) y popularidad (`viewsCount`, `reviewCount`).

**Consumidor en funcionamiento:** en `/negocios` → "Filtros avanzados" puedes
elegir, por ejemplo, *rating mínimo 4.5* (10 negocios en los datos reales),
sumar *Destacados* (5) y *2 fotos* (4): cada paso ejecuta el `find(...)` con
los operadores indicados y actualiza las fichas al instante.

`backend/test/smoke.test.mjs` verifica cada operador contra los datos reales:
rango `$gte + $lte`, `$in` de precios, `$eq` de destacados, `$exists + $ne`
de promociones y los arreglos `$size` / `$not { $size: 0 }`.

## Notas técnicas

- **Subida de fotos:** `POST /api/businesses/:id/photos` (multipart, campo
  `photos`, hasta 5 archivos por carga y 10 MB c/u, solo JPG/PNG/WebP). El servidor genera
  el nombre de archivo y valida que el dueño edite su propio negocio.
  `DELETE /api/businesses/:id/photos` con `{ url }` borra el archivo del disco.
- **Permisos:** los dueños editan solo su negocio (verificado por
  `username + businessId + role:owner`); las estadísticas y el CRUD completo
  son de admin. El JWT expira a las 8 h.
- **Registro público y aprobación:** `POST /api/businesses/register` (sin
  login) crea el negocio en `active: false` y la cuenta del dueño inactiva;
  mientras tanto no aparece en el directorio ni el dueño puede entrar.
  `POST /api/businesses/:id/approve` (admin) publica la ficha y habilita al
  dueño; `POST /api/businesses/:id/reject` (admin) elimina ficha y cuenta.
- **`JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD` y `MONGODB_URI`** viven en
  `backend/.env` (no versionado). El secreto se lee del entorno en el momento
  de firmar (no al importar el módulo), por el orden de evaluación de imports en ESM.