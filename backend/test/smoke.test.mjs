/**
 * Smoke tests de la API LocalMarket (node:test + fetch, sin dependencias).
 *
 * Requieren que el backend esté corriendo en :3000 (mismo puerto de la demo)
 * y que la BD local tenga los datos de `npm run seed`.
 *
 *   npm test          -> ejecuta esta suite
 *   API_URL=... npm test  -> apunta a otra instancia
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const API = (process.env.API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

const ADMIN = { username: 'admin', password: 'admin123' };
const OWNER = {
  username: 'comedor-mili-san-raymundo',
  businessId: 'comedor-mili-san-raymundo',
  password: 'owner123',
};

let serverUp = false;

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respuestas sin cuerpo JSON */
  }
  return { status: res.status, json };
}

function skipIfDown(t) {
  if (!serverUp) t.skip(`backend no disponible en ${API}`);
}

describe('LocalMarket API', () => {
  before(async () => {
    try {
      const res = await fetch(`${API}/businesses`);
      serverUp = res.ok;
    } catch {
      serverUp = false;
    }
  });

  // ---- parte pública ----
  test('GET /businesses devuelve una lista', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json) && json.length > 0);
  });

  test('GET /categories devuelve categorías', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/categories');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json) && json.length > 0);
    assert.ok(json.every((c) => typeof c.name === 'string'));
  });

  test('GET /businesses/:id trae un negocio conocido del seed', async (t) => {
    skipIfDown(t);
    const { status, json } = await api(`/businesses/${OWNER.businessId}`);
    assert.equal(status, 200);
    assert.equal(json._id, OWNER.businessId);
  });

  test('las reseñas de un negocio son una lista con resumen', async (t) => {
    skipIfDown(t);
    const { status, json } = await api(`/reviews/${OWNER.businessId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.reviews));
    assert.equal(typeof json.count, 'number');
    assert.equal(typeof json.average, 'number');
  });

  // ---- autenticación y permisos ----
  test('GET /businesses/stats sin token -> 401', async (t) => {
    skipIfDown(t);
    const { status } = await api('/businesses/stats');
    assert.equal(status, 401);
  });

  test('login admin devuelve token y rol admin', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/auth/login', {
      method: 'POST',
      body: ADMIN,
    });
    assert.equal(status, 200);
    assert.ok(typeof json.token === 'string' && json.token.length > 10);
    assert.equal(json.role, 'admin');
    assert.equal(json.username, ADMIN.username);
  });

  test('login owner devuelve rol owner y su negocio vinculado', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/auth/login', {
      method: 'POST',
      body: { username: OWNER.username, password: OWNER.password },
    });
    assert.equal(status, 200);
    assert.equal(json.role, 'owner');
    assert.equal(json.businessId, OWNER.businessId);
  });

  test('login con credenciales inválidas -> 401', async (t) => {
    skipIfDown(t);
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: { username: 'cualquiera', password: 'incorrecta' },
    });
    assert.equal(status, 401);
  });

  test('el admin ve las estadísticas completas', async (t) => {
    skipIfDown(t);
    const login = await api('/auth/login', { method: 'POST', body: ADMIN });
    const { status, json } = await api('/businesses/stats', { token: login.json.token });
    assert.equal(status, 200);
    assert.equal(typeof json.total, 'number');
    assert.equal(typeof json.owners, 'number');
    assert.ok(Array.isArray(json.byCategory));
  });

  test('un owner NO puede ver las estadísticas (403)', async (t) => {
    skipIfDown(t);
    const login = await api('/auth/login', {
      method: 'POST',
      body: { username: OWNER.username, password: OWNER.password },
    });
    const { status } = await api('/businesses/stats', { token: login.json.token });
    assert.equal(status, 403);
  });

  test('un owner NO puede editar el negocio de otro (403)', async (t) => {
    skipIfDown(t);
    const list = await api('/businesses');
    const other = (list.json || []).find((b) => b._id !== OWNER.businessId);
    if (!other) return t.skip('no hay otro negocio en la BD para probar permisos');

    const login = await api('/auth/login', {
      method: 'POST',
      body: { username: OWNER.username, password: OWNER.password },
    });
    const { status } = await api(`/businesses/${other._id}`, {
      method: 'PUT',
      token: login.json.token,
      body: { name: 'intento de edicion ajena' },
    });
    assert.equal(status, 403);
  });

  // ---- operadores de consulta en la lista pública (filtros avanzados) ----
  test('GET /zones devuelve las zonas públicas con su conteo', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses/zones');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json) && json.length > 0);
    assert.ok(json.every((z) => typeof z._id === 'string' && typeof z.count === 'number'));
  });

  test('rango de rating con $gte + $lte aplica ambos lados', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?ratingMin=4.5&ratingMax=5');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => b.rating >= 4.5 && b.rating <= 5));
  });

  test('precio con $in filtra por varias opciones', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?price=$,$$');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => b.priceRange === '$' || b.priceRange === '$$'));
  });

  test('destacados con $eq true', async (t) => {
    skipIfDown(t);
    // 6 semillas destacadas; el resto no
    const featured = (await api('/businesses?featured=1')).json;
    const all = (await api('/businesses')).json;
    assert.equal(featured.length, all.filter((b) => b.featured).length);
    assert.ok(featured.every((b) => b.featured === true));
  });

  test('promoción vigente con $exists + $ne', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?promo=1');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => typeof b.promoText === 'string' && b.promoText !== ''));
  });

  test('cantidad exacta de fotos con $size', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?fotos=2');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => (b.photoUrls || []).length === 2));
  });

  test('al menos una foto con $not { $size: 0 }', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?photos=1');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => (b.photoUrls || []).length > 0));
  });

  // ---- campos nuevos (contacto, servicios, entregas, popularidad, ofertas) ----
  test('los negocios del seed traen servicios, tags y popularidad', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses');
    assert.equal(status, 200);
    const conDatos = json.filter((b) => (b.servicios || []).length > 0);
    assert.ok(conDatos.length > 0, 'se esperaban negocios con servicios poblados');
    assert.ok(conDatos.every((b) => Array.isArray(b.tags) && Number.isFinite(b.viewsCount)));
  });

  test('"con envío" con $eq true filtra solo los que reparten', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?delivery=1');
    assert.equal(status, 200);
    assert.ok(json.length > 0);
    assert.ok(json.every((b) => b.delivery === true));
  });

  test('las ofertas estructuradas vienen como arreglo consultable', async (t) => {
    skipIfDown(t);
    const { status, json } = await api('/businesses?featured=1');
    assert.equal(status, 200);
    const conPromos = json.filter((b) => (b.promos || []).length > 0);
    assert.ok(conPromos.length > 0, 'se esperaban negocios con promos estructuradas');
    const usados = conPromos.find((b) => (b.promos || []).some((p) => p.titulo));
    assert.ok(usados, 'toda promo estructurada debe tener título');
  });

  test('el horario estructurado se deriva del mapa legible', async (t) => {
    skipIfDown(t);
    const { status, json } = await api(`/businesses/${OWNER.businessId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.openingHours) && json.openingHours.length > 0);
    assert.ok(json.openingHours.every((r) => typeof r.dia === 'string' && Boolean(r.dia)));
  });
});