const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanPkg(row) {
  if (!row) return null;
  const price = row.price != null && typeof row.price.toNumber === 'function' ? row.price.toNumber() : Number(row.price);
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    price,
    lessonCount: row.lessonCount,
    durationDays: row.durationDays,
    features: row.features || [],
    active: row.active,
    featured: row.featured,
    createdAt: row.createdAt,
  };
}

function find() {
  return createFindChain(async (state) => {
    const orderBy = state.sortObj && state.sortObj.createdAt === -1 ? { createdAt: 'desc' } : { createdAt: 'desc' };
    const rows = await getPrisma().package.findMany({ orderBy });
    return rows.map((r) => (state.lean ? leanPkg(r) : r));
  });
}

async function create(data) {
  return getPrisma().package.create({
    data: {
      name: data.name,
      price: Number(data.price) || 0,
      lessonCount: data.lessonCount ?? 0,
      durationDays: data.durationDays ?? 30,
      features: data.features || [],
      active: data.active !== false,
      featured: Boolean(data.featured),
    },
  });
}

async function findByIdAndUpdate(id, data) {
  const pid = asUuid(id);
  if (!pid) return null;
  const d = { ...data };
  if (d.price != null) d.price = Number(d.price);
  return getPrisma().package.update({ where: { id: pid }, data: d });
}

module.exports = { find, create, findByIdAndUpdate };
