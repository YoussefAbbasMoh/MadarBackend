const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

function numAmount(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && v !== null && typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function leanTxn(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    studentId: row.studentId,
    packageId: row.packageId,
    courseId: row.courseId,
    amount: numAmount(row.amount),
    promoCode: row.promoCode,
    promoDiscount: numAmount(row.promoDiscount),
    paymobRef: row.paymobRef,
    paymentMethod: row.paymentMethod,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function find(filter) {
  return createFindChain(async (state) => {
    const orderBy =
      state.sortObj && state.sortObj.createdAt === -1 ? { createdAt: 'desc' } : { createdAt: 'desc' };
    const rows = await getPrisma().transaction.findMany({
      orderBy,
      take: state.limitN ?? undefined,
    });
    return rows.map((r) => (state.lean ? leanTxn(r) : r));
  });
}

function findById(id) {
  return createFindChain(async (state) => {
    const uid = asUuid(id);
    if (!uid) return null;
    const row = await getPrisma().transaction.findUnique({ where: { id: uid } });
    if (!row) return null;
    return state.lean ? leanTxn(row) : row;
  });
}

async function create(data) {
  return getPrisma().transaction.create({
    data: {
      studentId: asUuid(data.studentId),
      packageId: data.packageId ? asUuid(data.packageId) : null,
      courseId: data.courseId ? asUuid(data.courseId) : null,
      amount: Number(data.amount) || 0,
      promoCode: data.promoCode,
      promoDiscount: Number(data.promoDiscount) || 0,
      paymobRef: data.paymobRef,
      paymentMethod: data.paymentMethod,
      status: data.status || 'pending',
    },
  });
}

function netAmount(row) {
  return numAmount(row.amount) - numAmount(row.promoDiscount);
}

async function aggregate(pipeline) {
  const [m1, g1] = pipeline || [];
  if (m1 && m1.$match && m1.$match.status === 'paid' && g1 && g1.$group) {
    const match = m1.$match;
    const where = { status: 'paid' };
    if (match.courseId && match.courseId.$in) {
      where.courseId = { in: match.courseId.$in.map((x) => asUuid(x)).filter(Boolean) };
    }
    if (match.createdAt && match.createdAt.$gte) {
      where.createdAt = { gte: match.createdAt.$gte };
    }
    const rows = await getPrisma().transaction.findMany({ where, select: { createdAt: true, amount: true, promoDiscount: true, courseId: true } });
    if (g1.$group && g1.$group._id && g1.$group._id.y !== undefined) {
      const map = new Map();
      for (const r of rows) {
        if (!r.createdAt) continue;
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        map.set(key, (map.get(key) || 0) + netAmount(r));
      }
      return [...map.entries()].map(([k, total]) => {
        const [y, m] = k.split('-').map(Number);
        return { _id: { y, m }, total };
      });
    }
    if (g1.$group && g1.$group._id === null) {
      const total = rows.reduce((s, r) => s + netAmount(r), 0);
      return [{ _id: null, total, cnt: rows.length }];
    }
    if (g1.$group && g1.$group._id === '$courseId') {
      const byCourse = new Map();
      for (const r of rows) {
        if (!r.courseId) continue;
        const k = String(r.courseId);
        byCourse.set(k, (byCourse.get(k) || 0) + netAmount(r));
      }
      return [...byCourse.entries()]
        .map(([k, total]) => ({ _id: k, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12);
    }
    if (g1.$group && g1.$group._id && g1.$group._id.$month === '$createdAt') {
      const byMonth = new Map();
      for (const r of rows) {
        if (!r.createdAt) continue;
        const month = new Date(r.createdAt).getMonth() + 1;
        byMonth.set(month, (byMonth.get(month) || 0) + netAmount(r));
      }
      return [...byMonth.entries()]
        .map(([month, total]) => ({ _id: month, total }))
        .sort((a, b) => a._id - b._id);
    }
  }
  return [];
}

module.exports = { find, findById, create, aggregate };
