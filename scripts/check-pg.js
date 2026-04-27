/**
 * Quick check that DATABASE_URL is reachable (PostgreSQL + Sequelize).
 * Usage: DATABASE_URL=postgresql://... node scripts/check-pg.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getPrisma, disconnectPrisma } = require('../src/db/prisma');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL in backend/.env');
    process.exit(1);
  }
  try {
    await getPrisma().$connect();
    await getPrisma().$queryRaw`SELECT 1`;
    console.log('PostgreSQL OK (Sequelize connected).');
  } finally {
    await disconnectPrisma();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
