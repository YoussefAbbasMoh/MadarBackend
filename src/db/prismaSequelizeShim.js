const { Op } = require('sequelize');
const { getTenantQueryStore } = require('../context/tenantQueryScope');

function activeTenantId() {
  const s = getTenantQueryStore();
  if (!s || s.skipTenantScope) return null;
  return s.tenantId || null;
}

/** AND-merge `tenantId` (or `tenantField`) into a Sequelize `where` object. */
function withTenant(whereMapped, tenantField = 'tenantId') {
  const tid = activeTenantId();
  if (!tid) return whereMapped;
  const clause = { [tenantField]: tid };
  if (!whereMapped || !Object.keys(whereMapped).length) return clause;
  if (whereMapped[Op.and]) {
    return { [Op.and]: [...whereMapped[Op.and], clause] };
  }
  return { [Op.and]: [whereMapped, clause] };
}

function toPlain(row) {
  if (row == null) return row;
  if (typeof row.get === 'function') return row.get({ plain: true });
  return row;
}

function toPlainDeep(row) {
  const p = toPlain(row);
  if (!p || typeof p !== 'object') return p;
  const out = { ...p };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v && typeof v === 'object' && typeof v.get === 'function') out[k] = toPlainDeep(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (x && typeof x.get === 'function' ? toPlainDeep(x) : x));
  }
  return out;
}

/**
 * Prisma-shaped API backed by Sequelize (keeps `src/models/pg/*` callers stable).
 */
function createPrismaSequelizeShim(sequelize, models) {
  const esc = (v) => sequelize.escape(v);

  const {
    User,
    UserAssignedCourse,
    Package,
    Course,
    CourseEnrollment,
    CourseAssistant,
    Lesson,
    SubLesson,
    Assessment,
    Submission,
    Progress,
    Notification,
    Message,
    LiveSession,
    Transaction,
    PromoCode,
    AgentSession,
  } = models;

  function mapOrder(orderBy) {
    if (!orderBy) return undefined;
    return Object.entries(orderBy).map(([k, dir]) => [
      k,
      String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC',
    ]);
  }

  /** Prisma-style nested conditions → Sequelize `where` (non-Course models). */
  function mapWhere(where) {
    if (!where || !Object.keys(where).length) return {};
    const topKeys = Object.keys(where);
    /** Prisma allows `{ a: 1, b: 2, OR: [...] }` meaning `(a AND b AND (OR...))`. */
    if (where.OR && topKeys.length > 1) {
      const { OR, ...rest } = where;
      return { [Op.and]: [mapWhere(rest), { [Op.or]: OR.map((w) => mapWhere(w)) }] };
    }
    if (where.OR) return { [Op.or]: where.OR.map((w) => mapWhere(w)) };
    if (where.AND) return { [Op.and]: where.AND.map((w) => mapWhere(w)) };
    const out = {};
    for (const [key, val] of Object.entries(where)) {
      if (val && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
        const inner = {};
        if ('in' in val) inner[Op.in] = val.in;
        if ('not' in val) {
          if (val.not === null) inner[Op.ne] = null;
          else inner[Op.ne] = val.not;
        }
        if ('equals' in val && val.equals === null) {
          out[key] = null;
          continue;
        }
        if (val.gte !== undefined) inner[Op.gte] = val.gte;
        if (val.lte !== undefined) inner[Op.lte] = val.lte;
        if (val.lt !== undefined) inner[Op.lt] = val.lt;
        if (val.gt !== undefined) inner[Op.gt] = val.gt;
        if (Object.keys(inner).length) out[key] = inner;
        else out[key] = val;
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  function coursePrismaWhereToSequelize(where) {
    if (!where || !Object.keys(where).length) return {};

    function branch(w) {
      const flat = {};
      const exists = [];
      if (!w || typeof w !== 'object') return {};
      for (const [k, v] of Object.entries(w)) {
        if (k === 'enrollments' && v && typeof v === 'object' && v.some && v.some.studentId) {
          exists.push(
            sequelize.literal(
              `EXISTS (SELECT 1 FROM "CourseEnrollment" AS ce WHERE ce."courseId" = "Course"."id" AND ce."studentId" = ${esc(
                v.some.studentId,
              )})`,
            ),
          );
          continue;
        }
        if (k === 'assistants' && v && typeof v === 'object' && v.some && v.some.userId) {
          exists.push(
            sequelize.literal(
              `EXISTS (SELECT 1 FROM "CourseAssistant" AS ca WHERE ca."courseId" = "Course"."id" AND ca."userId" = ${esc(
                v.some.userId,
              )})`,
            ),
          );
          continue;
        }
        if (k === 'id' && v && typeof v === 'object' && v.in) flat.id = { [Op.in]: v.in };
        else if (k === 'id') flat.id = v;
        else if (['status', 'ownerId', 'title', 'category', 'description', 'tenantId'].includes(k)) flat[k] = v;
      }
      const hasFlat = Object.keys(flat).length > 0;
      if (!exists.length) return hasFlat ? flat : {};
      if (!hasFlat && exists.length === 1) return exists[0];
      return { [Op.and]: [...(hasFlat ? [flat] : []), ...exists] };
    }

    if (where.OR) return { [Op.or]: where.OR.map(branch) };
    if (where.AND) return { [Op.and]: where.AND.map(branch) };
    return branch(where);
  }

  const courseListInclude = () => [
    { model: CourseEnrollment, as: 'enrollments', attributes: ['studentId'], required: false },
    { model: CourseAssistant, as: 'assistants', required: false },
  ];

  function courseWhereMerged(where) {
    return withTenant(coursePrismaWhereToSequelize(where), 'tenantId');
  }

  async function tenantIdForCourseId(courseId) {
    if (!courseId) return activeTenantId();
    const tid = activeTenantId();
    const row = await Course.findOne({
      where: tid ? { id: courseId, tenantId: tid } : { id: courseId },
      attributes: ['tenantId'],
    });
    return row?.tenantId || tid || null;
  }

  async function $connect() {
    await sequelize.authenticate();
  }

  async function $disconnect() {
    await sequelize.close();
  }

  async function $queryRaw(strings, ...values) {
    let sql = strings[0];
    for (let i = 0; i < values.length; i += 1) {
      sql += esc(values[i]) + strings[i + 1];
    }
    await sequelize.query(sql);
  }

  function mapAttributes(select) {
    if (!select) return undefined;
    return Object.keys(select).filter((k) => select[k]);
  }

  function pickSelect(row, select) {
    if (!select) return toPlainDeep(row);
    const p = toPlainDeep(row);
    const out = {};
    for (const k of Object.keys(select)) {
      if (select[k] && Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
    }
    return out;
  }

  const user = {
    async findUnique({ where, include }) {
      const row = await User.findOne({
        where: withTenant(mapWhere(where)),
        include: include
          ? [{ model: UserAssignedCourse, as: 'assignedCourseLinks', attributes: ['courseId'] }]
          : undefined,
      });
      return row ? toPlainDeep(row) : null;
    },
    async findFirst({ where, include }) {
      const row = await User.findOne({
        where: withTenant(mapWhere(where)),
        include: include
          ? [{ model: UserAssignedCourse, as: 'assignedCourseLinks', attributes: ['courseId'] }]
          : undefined,
      });
      return row ? toPlainDeep(row) : null;
    },
    async findMany({ where, orderBy, take, include }) {
      const rows = await User.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        limit: take,
        include: include
          ? [{ model: UserAssignedCourse, as: 'assignedCourseLinks', attributes: ['courseId'] }]
          : undefined,
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data, include }) {
      const tid = activeTenantId();
      const payload = { ...data };
      if (payload.tenantId == null && tid != null) payload.tenantId = tid;
      const row = await User.create(payload);
      if (include) {
        const re = await User.findOne({
          where: withTenant({ id: row.id }),
          include: [{ model: UserAssignedCourse, as: 'assignedCourseLinks', attributes: ['courseId'] }],
        });
        return toPlainDeep(re);
      }
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      const d = { ...data };
      if (d.instructorPortfolio === undefined) delete d.instructorPortfolio;
      await User.update(d, { where: withTenant(mapWhere(where)) });
    },
    async updateMany({ where, data }) {
      const [n] = await User.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
    async count({ where }) {
      return User.count({ where: withTenant(mapWhere(where)) });
    },
  };

  const userAssignedCourse = {
    async upsert({ where, create, update }) {
      const w = where.userId_courseId || where;
      const userId = create.userId ?? w.userId;
      const courseId = create.courseId ?? w.courseId;
      const tenantId = create.tenantId ?? (await tenantIdForCourseId(courseId));
      const existing = await UserAssignedCourse.findOne({ where: { userId, courseId } });
      if (existing) {
        if (update && Object.keys(update).length) await UserAssignedCourse.update(update, { where: { userId, courseId } });
        else if (tenantId && !existing.tenantId) await existing.update({ tenantId });
      } else {
        await UserAssignedCourse.create({ userId, courseId, tenantId, ...create });
      }
    },
    async deleteMany({ where }) {
      const n = await UserAssignedCourse.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const course = {
    async findUnique({ where, include, select }) {
      const row = await Course.findOne({
        where: courseWhereMerged(where),
        attributes: mapAttributes(select),
        include: include ? courseListInclude() : undefined,
      });
      return row ? pickSelect(row, select) : null;
    },
    async findFirst({ where, include }) {
      const row = await Course.findOne({
        where: courseWhereMerged(where),
        include: include ? courseListInclude() : undefined,
      });
      return row ? toPlainDeep(row) : null;
    },
    async findMany({ where, orderBy, take, include, distinct, select }) {
      const cw = courseWhereMerged(where);
      if (distinct && distinct[0] === 'ownerId') {
        const rows = await Course.findAll({
          where: cw,
          attributes: ['ownerId'],
          group: ['ownerId'],
          raw: true,
        });
        return rows.map((r) => ({ ownerId: r.ownerId }));
      }
      const rows = await Course.findAll({
        where: cw,
        order: mapOrder(orderBy),
        limit: take,
        attributes: mapAttributes(select),
        include: include ? courseListInclude() : undefined,
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async count({ where }) {
      return Course.count({ where: courseWhereMerged(where) });
    },
    async create({ data, include }) {
      const tid = activeTenantId();
      const payload = { ...data, kind: data.kind != null ? data.kind : 'classroom' };
      if (payload.tenantId == null && tid != null) payload.tenantId = tid;
      const row = await Course.create(payload);
      if (include) {
        const full = await Course.findOne({
          where: courseWhereMerged({ id: row.id }),
          include: courseListInclude(),
        });
        return toPlainDeep(full);
      }
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await Course.update(data, { where: courseWhereMerged(where) });
    },
    async deleteMany({ where }) {
      const n = await Course.destroy({ where: courseWhereMerged(where) });
      return { count: n };
    },
    async groupBy({ by, where, _count }) {
      const field = by[0];
      const cw = courseWhereMerged(where);
      const rows = await Course.findAll({
        attributes: [field, [sequelize.fn('COUNT', sequelize.col('Course.id')), '_cnt']],
        where: cw,
        group: [field],
        raw: true,
      });
      return rows.map((r) => ({
        [field]: r[field],
        _count: { _all: Number(r._cnt) },
      }));
    },
  };

  const courseEnrollment = {
    async upsert({ where, create, update }) {
      const w = where.courseId_studentId || where;
      const courseId = create.courseId ?? w.courseId;
      const studentId = create.studentId ?? w.studentId;
      const tenantId = create.tenantId ?? (await tenantIdForCourseId(courseId));
      const existing = await CourseEnrollment.findOne({ where: { courseId, studentId } });
      if (existing) {
        if (update && Object.keys(update).length)
          await CourseEnrollment.update(update, { where: { courseId, studentId } });
      } else {
        await CourseEnrollment.create({ courseId, studentId, tenantId, ...create });
      }
    },
    async deleteMany({ where }) {
      const n = await CourseEnrollment.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const courseAssistant = {
    async upsert({ where, create, update }) {
      const w = where.courseId_userId || where;
      const courseId = create.courseId ?? w.courseId;
      const userId = create.userId ?? w.userId;
      const tenantId = create.tenantId ?? (await tenantIdForCourseId(courseId));
      const existing = await CourseAssistant.findOne({ where: { courseId, userId } });
      if (existing) {
        await CourseAssistant.update({ ...update }, { where: { courseId, userId } });
      } else {
        await CourseAssistant.create({ ...create, courseId, userId, tenantId });
      }
    },
    async deleteMany({ where }) {
      const n = await CourseAssistant.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
    async updateMany({ where, data }) {
      const [n] = await CourseAssistant.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const lesson = {
    async findUnique({ where, select }) {
      const row = await Lesson.findOne({
        where: withTenant(mapWhere(where)),
        attributes: mapAttributes(select),
      });
      return row ? pickSelect(row, select) : null;
    },
    async findMany({ where, orderBy }) {
      const rows = await Lesson.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await Lesson.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await Lesson.update(data, { where: withTenant(mapWhere(where)) });
    },
    async count({ where }) {
      return Lesson.count({ where: withTenant(mapWhere(where)) });
    },
    async deleteMany({ where }) {
      const n = await Lesson.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
    async groupBy({ by, where, _count }) {
      const field = by[0];
      const rows = await Lesson.findAll({
        attributes: [field, [sequelize.fn('COUNT', sequelize.col('Lesson.id')), '_cnt']],
        where: withTenant(mapWhere(where)),
        group: [field],
        raw: true,
      });
      return rows.map((r) => ({
        [field]: r[field],
        _count: { _all: Number(r._cnt) },
      }));
    },
  };

  const subLesson = {
    async findUnique({ where }) {
      const row = await SubLesson.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async findMany({ where, orderBy }) {
      const rows = await SubLesson.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await SubLesson.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await SubLesson.update(data, { where: withTenant(mapWhere(where)) });
    },
    async count({ where }) {
      return SubLesson.count({ where: withTenant(mapWhere(where)) });
    },
    async deleteMany({ where }) {
      const n = await SubLesson.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
    async updateMany({ where, data }) {
      const [n] = await SubLesson.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const assessment = {
    async findUnique({ where, include }) {
      const inc =
        include && include.subLesson
          ? [{ model: SubLesson, as: 'subLesson', attributes: Object.keys(include.subLesson.select || {}) }]
          : undefined;
      const row = await Assessment.findOne({ where: withTenant(mapWhere(where)), include: inc });
      return row ? toPlainDeep(row) : null;
    },
    async findMany({ where, orderBy, include }) {
      const inc =
        include && include.subLesson
          ? [{ model: SubLesson, as: 'subLesson', attributes: Object.keys(include.subLesson.select || {}) }]
          : undefined;
      const rows = await Assessment.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        include: inc,
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await Assessment.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await Assessment.update(data, { where: withTenant(mapWhere(where)) });
    },
    async delete({ where }) {
      await Assessment.destroy({ where: withTenant(mapWhere(where)) });
    },
    async deleteMany({ where }) {
      const n = await Assessment.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const submission = {
    async findUnique({ where }) {
      const row = await Submission.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async findFirst({ where, orderBy }) {
      const row = await Submission.findOne({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
      });
      return row ? toPlainDeep(row) : null;
    },
    async findMany({ where, orderBy, take, select }) {
      const rows = await Submission.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        limit: take,
        attributes: mapAttributes(select),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await Submission.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await Submission.update(data, { where: withTenant(mapWhere(where)) });
    },
    async count({ where }) {
      return Submission.count({ where: withTenant(mapWhere(where)) });
    },
    async deleteMany({ where }) {
      const n = await Submission.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const progressWhereExtras = (where) => {
    const w = { ...where };
    if (w.completedSubLessonIds && w.completedSubLessonIds.isEmpty === false) {
      delete w.completedSubLessonIds;
      return {
        prismaWhere: w,
        extra: sequelize.literal('cardinality("Progress"."completedSubLessonIds") > 0'),
      };
    }
    return { prismaWhere: w, extra: null };
  };

  const progress = {
    async findMany({ where, select }) {
      const { prismaWhere, extra } = progressWhereExtras(where);
      const sq = withTenant(mapWhere(prismaWhere));
      const finalWhere = extra ? { [Op.and]: [sq, extra] } : sq;
      const rows = await Progress.findAll({
        where: finalWhere,
        attributes: mapAttributes(select),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async count({ where }) {
      const { prismaWhere, extra } = progressWhereExtras(where);
      const sq = withTenant(mapWhere(prismaWhere));
      const finalWhere = extra ? { [Op.and]: [sq, extra] } : sq;
      return Progress.count({ where: finalWhere });
    },
    async deleteMany({ where }) {
      const n = await Progress.destroy({ where: withTenant(mapWhere(where)) });
      return { count: n };
    },
    async upsert({ where, create, update }) {
      const w = where.studentId_courseId || where;
      const sid = w.studentId;
      const cid = w.courseId;
      const tenantId = create.tenantId ?? (await tenantIdForCourseId(cid));
      const existing = await Progress.findOne({ where: { studentId: sid, courseId: cid } });
      if (existing) {
        await Progress.update(update, { where: { id: existing.id } });
        const row = await Progress.findByPk(existing.id);
        return toPlainDeep(row);
      }
      const row = await Progress.create({ ...create, studentId: sid, courseId: cid, tenantId });
      return toPlainDeep(row);
    },
  };

  const notification = {
    async create({ data }) {
      const tid = data.tenantId ?? activeTenantId();
      const row = await Notification.create({ ...data, ...(tid != null ? { tenantId: tid } : {}) });
      return toPlainDeep(row);
    },
    async findMany({ where, orderBy, take }) {
      const rows = await Notification.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        limit: take,
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async findFirst({ where }) {
      const row = await Notification.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async count({ where }) {
      return Notification.count({ where: withTenant(mapWhere(where)) });
    },
    async update({ where, data }) {
      await Notification.update(data, { where: withTenant(mapWhere(where)) });
    },
    async updateMany({ where, data }) {
      const [n] = await Notification.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const message = {
    async findMany({ where, orderBy, take, select }) {
      const rows = await Message.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        limit: take,
        attributes: mapAttributes(select),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await Message.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async updateMany({ where, data }) {
      const [n] = await Message.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  const liveSession = {
    async findMany({ where, orderBy, take }) {
      const rows = await LiveSession.findAll({
        where: withTenant(mapWhere(where)),
        order: mapOrder(orderBy),
        limit: take,
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async findUnique({ where }) {
      const row = await LiveSession.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async findFirst({ where }) {
      const row = await LiveSession.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async create({ data }) {
      const tenantId = data.tenantId ?? (await tenantIdForCourseId(data.courseId));
      const row = await LiveSession.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await LiveSession.update(data, { where: withTenant(mapWhere(where)) });
    },
    async count({ where }) {
      return LiveSession.count({ where: withTenant(mapWhere(where)) });
    },
  };

  const transaction = {
    async findMany({ where, select, orderBy }) {
      const rows = await Transaction.findAll({
        where: withTenant(mapWhere(where)),
        attributes: mapAttributes(select),
        order: mapOrder(orderBy),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async findUnique({ where }) {
      const row = await Transaction.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async create({ data }) {
      const tenantId =
        data.tenantId ?? (data.courseId ? await tenantIdForCourseId(data.courseId) : activeTenantId());
      const row = await Transaction.create({ ...data, tenantId });
      return toPlainDeep(row);
    },
  };

  const promoCode = {
    async findMany({ orderBy }) {
      const rows = await PromoCode.findAll({
        where: withTenant({}),
        order: mapOrder(orderBy),
      });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tid = data.tenantId ?? activeTenantId();
      const row = await PromoCode.create({ ...data, ...(tid != null ? { tenantId: tid } : {}) });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await PromoCode.update(data, { where: withTenant(mapWhere(where)) });
      const row = await PromoCode.findOne({ where: withTenant(mapWhere(where)) });
      return toPlainDeep(row);
    },
  };

  const packageApi = {
    async findMany({ orderBy }) {
      const rows = await Package.findAll({ where: withTenant({}), order: mapOrder(orderBy) });
      return rows.map((r) => toPlainDeep(r));
    },
    async create({ data }) {
      const tid = data.tenantId ?? activeTenantId();
      const row = await Package.create({ ...data, ...(tid != null ? { tenantId: tid } : {}) });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await Package.update(data, { where: withTenant(mapWhere(where)) });
      const row = await Package.findOne({ where: withTenant(mapWhere(where)) });
      return toPlainDeep(row);
    },
  };

  const agentSession = {
    async findFirst({ where }) {
      const row = await AgentSession.findOne({ where: withTenant(mapWhere(where)) });
      return row ? toPlainDeep(row) : null;
    },
    async create({ data }) {
      const tid = data.tenantId ?? activeTenantId();
      const row = await AgentSession.create({ ...data, ...(tid != null ? { tenantId: tid } : {}) });
      return toPlainDeep(row);
    },
    async update({ where, data }) {
      await AgentSession.update(data, { where: withTenant(mapWhere(where)) });
    },
    async updateMany({ where, data }) {
      const [n] = await AgentSession.update(data, { where: withTenant(mapWhere(where)) });
      return { count: n };
    },
  };

  return {
    $connect,
    $disconnect,
    $queryRaw,
    user,
    userAssignedCourse,
    course,
    courseEnrollment,
    courseAssistant,
    lesson,
    subLesson,
    assessment,
    submission,
    progress,
    notification,
    message,
    liveSession,
    transaction,
    promoCode,
    package: packageApi,
    agentSession,
  };
}

module.exports = { createPrismaSequelizeShim };
