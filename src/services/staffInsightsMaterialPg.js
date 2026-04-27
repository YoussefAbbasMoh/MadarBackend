const { getPrisma } = require('../db/prisma');
const { asUuid } = require('../models/pg/_ids');

/**
 * PostgreSQL equivalent of the Mongo material-attention facet in staff insights.
 * @param {string[]} courseIds
 * @returns {Promise<{ top: object[], totals: { totalCompletionsRecorded: number, totalSeatMinutesEstimated: number }[] }>}
 */
async function materialAttentionFacet(courseIds) {
  const uuids = courseIds.map((x) => asUuid(x)).filter(Boolean);
  if (!uuids.length) {
    return { top: [], totals: [{ totalCompletionsRecorded: 0, totalSeatMinutesEstimated: 0 }] };
  }
  const p = getPrisma();
  const rows = await p.progress.findMany({
    where: { courseId: { in: uuids }, completedSubLessonIds: { isEmpty: false } },
    select: { completedSubLessonIds: true },
  });
  const countBySub = new Map();
  for (const r of rows) {
    for (const sid of r.completedSubLessonIds || []) {
      const k = String(sid);
      countBySub.set(k, (countBySub.get(k) || 0) + 1);
    }
  }
  const subIds = [...countBySub.keys()].map((k) => asUuid(k)).filter(Boolean);
  if (!subIds.length) {
    return { top: [], totals: [{ totalCompletionsRecorded: 0, totalSeatMinutesEstimated: 0 }] };
  }
  const subs = await p.subLesson.findMany({
    where: { id: { in: subIds } },
    select: { id: true, courseId: true, title: true, type: true, estimatedMinutes: true },
  });
  const all = subs.map((s) => {
    const completionCount = countBySub.get(String(s.id)) || 0;
    const estimatedMinutes = Math.max(0, Number(s.estimatedMinutes) || 0);
    return {
      subLessonId: s.id,
      courseId: s.courseId,
      title: s.title || 'Unknown or removed material',
      type: s.type || 'unknown',
      estimatedMinutes: Math.round(estimatedMinutes * 10) / 10,
      completionCount,
      seatMinutesEstimated: completionCount * estimatedMinutes,
    };
  });
  const totalCompletionsRecorded = [...countBySub.values()].reduce((a, b) => a + b, 0);
  const totalSeatMinutesEstimated = all.reduce((s, r) => s + r.seatMinutesEstimated, 0);
  const top = [...all].sort((a, b) => b.seatMinutesEstimated - a.seatMinutesEstimated || b.completionCount - a.completionCount).slice(0, 25);
  return {
    top,
    totals: [{ totalCompletionsRecorded, totalSeatMinutesEstimated }],
  };
}

module.exports = { materialAttentionFacet };
