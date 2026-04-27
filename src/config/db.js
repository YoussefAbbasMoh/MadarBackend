const env = require('./env');
const { getPrisma, disconnectPrisma } = require('../db/prisma');

function redactDatabaseUrl(url) {
  return String(url).replace(/:\/\/([^@/]+)@/, '://***@');
}

async function connectDb() {
  const url = String(env.databaseUrl || '').trim();
  if (!url) {
    console.error('\n[PostgreSQL] DATABASE_URL is not set.');
    console.error('  Set DATABASE_URL in backend/.env (Sequelize + PostgreSQL).\n');
    throw new Error('DATABASE_URL is required.');
  }
  try {
    await getPrisma().$connect();
  } catch (err) {
    console.error('\n[PostgreSQL] Could not connect.');
    console.error('  URL:', redactDatabaseUrl(url));
    console.error('  Error:', err.message);
    throw err;
  }
  return { driver: 'postgres' };
}

module.exports = { connectDb, disconnectPrisma };
