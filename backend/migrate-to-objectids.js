import { config } from 'dotenv';
config({ override: true });
import mongoose from 'mongoose';

async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/localmarket';
  console.log(`Conectando a MongoDB en: ${uri}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('--- Iniciando migración a ObjectIds estándar ---');

  const oldUsers = await db.collection('users').find().toArray();
  const oldBusinesses = await db.collection('businesses').find().toArray();
  const oldReviews = await db.collection('reviews').find().toArray();

  console.log(`Leídos: ${oldUsers.length} usuarios, ${oldBusinesses.length} negocios, ${oldReviews.length} reseñas.`);

  // 1. Crear copias de seguridad de las colecciones actuales
  const timestamp = Date.now();
  await db.collection(`users_backup_${timestamp}`).insertMany(oldUsers);
  if (oldBusinesses.length > 0) {
    await db.collection(`businesses_backup_${timestamp}`).insertMany(oldBusinesses);
  }
  if (oldReviews.length > 0) {
    await db.collection(`reviews_backup_${timestamp}`).insertMany(oldReviews);
  }
  console.log(`Copias de seguridad guardadas con prefijo backup_${timestamp}`);

  // 2. Mapear usuarios con nuevos ObjectId
  const userMap = new Map(); // oldId/username -> new ObjectId
  const newUsers = oldUsers.map((u) => {
    const isAlreadyObjectId = mongoose.isValidObjectId(u._id) && String(u._id).length === 24 && !u._id.includes('-');
    const newId = isAlreadyObjectId ? new mongoose.Types.ObjectId(u._id) : new mongoose.Types.ObjectId();
    userMap.set(String(u._id), newId);
    userMap.set(u.username, newId);

    const doc = { ...u, _id: newId };
    return doc;
  });

  // 3. Mapear negocios con nuevos ObjectId y asignar slug + ownerId
  const businessMap = new Map(); // oldId -> new ObjectId
  const newBusinesses = oldBusinesses.map((b) => {
    const isAlreadyObjectId = mongoose.isValidObjectId(b._id) && String(b._id).length === 24 && !b._id.includes('-');
    const newId = isAlreadyObjectId ? new mongoose.Types.ObjectId(b._id) : new mongoose.Types.ObjectId();
    const oldIdStr = String(b._id);
    businessMap.set(oldIdStr, newId);

    const slug = b.slug || oldIdStr;
    const ownerUsername = b.ownerUsername || (userMap.has(oldIdStr) ? oldIdStr : '');
    const ownerId = userMap.get(ownerUsername) || userMap.get(oldIdStr) || null;

    const doc = {
      ...b,
      _id: newId,
      slug,
      ownerId,
      ownerUsername,
    };
    return doc;
  });

  // 4. Actualizar businessIds en los usuarios con los nuevos ObjectIds
  for (const u of newUsers) {
    const mappedBIds = [];
    const sourceIds = Array.isArray(u.businessIds) ? u.businessIds : [];
    if (u.businessId && !sourceIds.includes(u.businessId)) {
      sourceIds.push(u.businessId);
    }
    for (const bid of sourceIds) {
      const targetId = businessMap.get(String(bid));
      if (targetId) mappedBIds.push(targetId.toString());
      else mappedBIds.push(String(bid));
    }
    // Si no tenía y su username coincide con algún negocio
    if (mappedBIds.length === 0 && businessMap.has(u.username)) {
      mappedBIds.push(businessMap.get(u.username).toString());
    }

    u.businessIds = mappedBIds;
    u.businessId = mappedBIds[0] || '';
  }

  // 5. Mapear reseñas con nuevos ObjectId y relacionar businessId con nuevo ObjectId
  const newReviews = oldReviews.map((r) => {
    const isAlreadyObjectId = mongoose.isValidObjectId(r._id) && String(r._id).length === 24 && !r._id.includes('-');
    const newId = isAlreadyObjectId ? new mongoose.Types.ObjectId(r._id) : new mongoose.Types.ObjectId();
    const mappedBusinessId = businessMap.get(String(r.businessId)) || r.businessId;

    return {
      ...r,
      _id: newId,
      businessId: mappedBusinessId,
    };
  });

  // 6. Reemplazar colecciones de forma limpia
  await db.collection('users').deleteMany({});
  if (newUsers.length > 0) {
    await db.collection('users').insertMany(newUsers);
  }

  await db.collection('businesses').deleteMany({});
  if (newBusinesses.length > 0) {
    await db.collection('businesses').insertMany(newBusinesses);
  }

  await db.collection('reviews').deleteMany({});
  if (newReviews.length > 0) {
    await db.collection('reviews').insertMany(newReviews);
  }

  console.log('--- Migración completada con éxito ---');
  console.log(`Usuarios migrados: ${newUsers.length}`);
  console.log(`Negocios migrados: ${newBusinesses.length}`);
  console.log(`Reseñas migradas: ${newReviews.length}`);

  // Muestra de ejemplo
  const sampleUser = await db.collection('users').findOne({ role: 'owner' });
  const sampleBiz = await db.collection('businesses').findOne({ slug: 'comedor-mili-san-raymundo' });
  console.log('\nEjemplo de usuario migrado:', {
    _id: sampleUser._id,
    type: typeof sampleUser._id,
    username: sampleUser.username,
    businessId: sampleUser.businessId,
  });
  console.log('Ejemplo de negocio migrado:', {
    _id: sampleBiz._id,
    type: typeof sampleBiz._id,
    name: sampleBiz.name,
    slug: sampleBiz.slug,
    ownerId: sampleBiz.ownerId,
  });

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Error en la migración:', err);
  process.exit(1);
});
