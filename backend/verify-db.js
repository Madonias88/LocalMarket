import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/localmarket';

async function check() {
  console.log('Conectando a MongoDB en:', uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log('\n======================================================');
  console.log('  VERIFICACIÓN DE BASE DE DATOS LOCALMARKET (MONGODB)');
  console.log('======================================================\n');

  // 1. Colección businesses
  const sampleBiz = await db.collection('businesses').findOne({ slug: 'comedor-mili-san-raymundo' });
  console.log('1. COLECCIÓN: businesses (Negocios)');
  console.log('   - Nombre:', sampleBiz?.name);
  console.log('   - _id:', sampleBiz?._id, `(Tipo: ${sampleBiz?._id?.constructor?.name})`);
  console.log('   - slug:', sampleBiz?.slug);
  console.log('   - ownerId:', sampleBiz?.ownerId, `(Tipo: ${sampleBiz?.ownerId?.constructor?.name})`);

  // 2. Colección users
  const sampleUser = await db.collection('users').findOne({ username: 'comedor-mili-san-raymundo' });
  console.log('\n2. COLECCIÓN: users (Usuarios)');
  console.log('   - Usuario:', sampleUser?.username);
  console.log('   - _id:', sampleUser?._id, `(Tipo: ${sampleUser?._id?.constructor?.name})`);
  console.log('   - businessId referenciado:', sampleUser?.businessId);
  console.log('   - ¿Coincide businessId con el _id del negocio?:', String(sampleUser?.businessId) === String(sampleBiz?._id) ? 'SÍ (Correcto)' : 'NO');

  // 3. Colección reviews
  const sampleReview = await db.collection('reviews').findOne({ businessId: sampleBiz?._id });
  console.log('\n3. COLECCIÓN: reviews (Reseñas)');
  console.log('   - _id de la reseña:', sampleReview?._id, `(Tipo: ${sampleReview?._id?.constructor?.name})`);
  console.log('   - businessId (FK):', sampleReview?.businessId, `(Tipo: ${sampleReview?.businessId?.constructor?.name})`);
  console.log('   - ¿Apunta correctamente al negocio?:', String(sampleReview?.businessId) === String(sampleBiz?._id) ? 'SÍ (Correcto)' : 'NO');

  // 4. Verificación de que no queden IDs viejos en string
  const stringBizCount = await db.collection('businesses').countDocuments({ _id: { $type: 'string' } });
  const stringUserCount = await db.collection('users').countDocuments({ _id: { $type: 'string' } });
  const stringRevCount = await db.collection('reviews').countDocuments({ _id: { $type: 'string' } });

  console.log('\n4. INTEGRIDAD: Documentos antiguos con _id tipo string:');
  console.log('   - En businesses:', stringBizCount, '(debe ser 0)');
  console.log('   - En users:     ', stringUserCount, '(debe ser 0)');
  console.log('   - En reviews:   ', stringRevCount, '(debe ser 0)');

  console.log('\n======================================================');
  if (stringBizCount === 0 && stringUserCount === 0 && stringRevCount === 0) {
    console.log(' ESTADO: TODOS LOS CAMBIOS FUERON APLICADOS CON ÉXITO');
  } else {
    console.log(' ADVERTENCIA: Aún existen documentos con ID antiguo');
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
}

check().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
