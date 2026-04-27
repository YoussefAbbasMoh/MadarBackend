const { getPrisma } = require('../db/prisma');
const { asUuid } = require('../models/pg/_ids');
const { materialAttentionFacet } = require('./staffInsightsMaterialPg');

function netTxn(row) {
  const amt = row.amount != null && typeof row.amount.toNumber === 'function' ? row.amount.toNumber() : Number(row.amount) || 0;
  const disc =
    row.promoDiscount != null && typeof row.promoDiscount.toNumber === 'function'
      ? row.promoDiscount.toNumber()
      : Number(row.promoDiscount) || 0;
  return amt - disc;
}

function rollupSumByYm(rows, getDate, sumFn) {
  const map = new Map();
  for (const r of rows) {
    const d = getDate(r);
    if (!d) continue;
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const key = `${y}-${m}`;
    map.set(key, (map.get(key) || 0) + sumFn(r));
  }
  return [...map.entries()].map(([key, total]) => {
    const [y, m] = key.split('-').map(Number);
    return { _id: { y, m }, total };
  });
}

function rollupCountByYm(rows, getDate) {
  const map = new Map();
  for (const r of rows) {
    const d = getDate(r);
    if (!d) continue;
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const key = `${y}-${m}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, n]) => {
    const [y, m] = key.split('-').map(Number);
    return { _id: { y, m }, n };
  });
}

/**
 * PostgreSQL-backed aggregations for GET /staff/insights (same shapes as Mongo pipelines).
 * @param {unknown[]} ids Course ids (UUID strings)
 * @param {Date} firstStart First bucket start (inclusive)
 */
async function runCourseInsights(ids, firstStart) {
  const p = getPrisma();
  const uuids = ids.map((x) => asUuid(x)).filter(Boolean);

  const revRows = await p.transaction.findMany({
    where: { status: 'paid', courseId: { in: uuids }, createdAt: { gte: firstStart } },
    select: { createdAt: true, amount: true, promoDiscount: true },
  });
  const revAgg = rollupSumByYm(revRows, (r) => r.createdAt, (r) => netTxn(r));

  const progEnroll = await p.progress.findMany({
    where: { courseId: { in: uuids }, createdAt: { gte: firstStart } },
    select: { createdAt: true },
  });
  const enrollAgg = rollupCountByYm(progEnroll, (r) => r.createdAt);

  const subRows = await p.submission.findMany({
    where: {
      courseId: { in: uuids },
      submittedAt: { not: null, gte: firstStart },
    },
    select: { submittedAt: true },
  });
  const subAgg = rollupCountByYm(subRows, (r) => r.submittedAt);

  const touchRows = await p.progress.findMany({
    where: { courseId: { in: uuids }, updatedAt: { gte: firstStart } },
    select: { updatedAt: true },
  });
  const touchAgg = rollupCountByYm(touchRows, (r) => r.updatedAt);

  const allProg = await p.progress.findMany({
    where: { courseId: { in: uuids } },
    select: { overallPercent: true },
  });
  const avg =
    allProg.length > 0 ? allProg.reduce((s, r) => s + (Number(r.overallPercent) || 0), 0) / allProg.length : 0;
  const avgProgRow = [{ _id: null, avg }];

  const lifeRows = await p.transaction.findMany({
    where: { status: 'paid', courseId: { in: uuids } },
    select: { courseId: true, amount: true, promoDiscount: true },
  });
  const lifeTotal = lifeRows.reduce((s, r) => s + netTxn(r), 0);
  const lifetimeRev = [{ _id: null, total: lifeTotal, cnt: lifeRows.length }];

  const byCourseMap = new Map();
  for (const r of lifeRows) {
    const cid = r.courseId;
    if (!cid) continue;
    byCourseMap.set(String(cid), (byCourseMap.get(String(cid)) || 0) + netTxn(r));
  }
  const byCourseRev = [...byCourseMap.entries()]
    .map(([k, total]) => ({ _id: k, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const materialFacet = await materialAttentionFacet(uuids);
  const materialFacetRaw = [materialFacet];

  return {
    revAgg,
    enrollAgg,
    subAgg,
    touchAgg,
    avgProgRow,
    lifetimeRev,
    byCourseRev,
    materialFacetRaw,
  };
}

module.exports = { runCourseInsights };
