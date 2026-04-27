const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function leanPromo(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    code: row.code,
    discountType: row.discountType,
    discountValue: row.discountValue != null && typeof row.discountValue.toNumber === 'function' ? row.discountValue.toNumber() : Number(row.discountValue),
    usageLimit: row.usageLimit,
    usageCount: row.usageCount,
    expiresAt: row.expiresAt,
    active: row.active,
    createdAt: row.createdAt,
  };
}

function find() {
  return createFindChain(async (state) => {
    const orderBy = state.sortObj && state.sortObj.createdAt === -1 ? { createdAt: 'desc' } : { createdAt: 'desc' };
    const rows = await getPrisma().promoCode.findMany({ orderBy });
    return rows.map((r) => (state.lean ? leanPromo(r) : r));
  });
}

async function create(data) {
  return getPrisma().promoCode.create({
    data: {
      code: String(data.code || '').toUpperCase().trim(),
      discountType: data.discountType,
      discountValue: Number(data.discountValue) || 0,
      usageLimit: data.usageLimit,
      usageCount: data.usageCount ?? 0,
      expiresAt: data.expiresAt,
      active: data.active !== false,
    },
  });
}

async function findByIdAndUpdate(id, data) {
  const pid = asUuid(id);
  if (!pid) return null;
  const d = { ...data };
  if (d.discountValue != null) d.discountValue = Number(d.discountValue);
  return getPrisma().promoCode.update({ where: { id: pid }, data: d });
}

module.exports = { find, create, findByIdAndUpdate };
