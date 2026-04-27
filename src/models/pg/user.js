const { getPrisma } = require('../../db/prisma');
const { createFindChain } = require('./_cursor');
const { asUuid } = require('./_ids');

const ROLES = [
  'super_admin',
  'instructor',
  'teacher',
  'doctor',
  'assistant',
  'student',
  'mudar_super_admin',
  'client_super_admin',
  'parent',
];

function leanFromRow(row, { stripPassword = true } = {}) {
  if (!row) return null;
  const links = row.assignedCourseLinks || [];
  const o = {
    _id: row.id,
    id: row.id,
    role: row.role,
    name: row.name,
    phone: row.phone,
    email: row.email,
    passwordHash: row.passwordHash,
    parentName: row.parentName,
    parentPhone: row.parentPhone,
    deviceFingerprints: row.deviceFingerprints || [],
    packageId: row.packageId,
    packageExpiry: row.packageExpiry,
    assignedCourses: links.map((l) => l.courseId),
    ownedBy: row.ownedBy,
    instructorPortfolio: row.instructorPortfolio,
    fcmToken: row.fcmToken,
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
  };
  if (stripPassword) delete o.passwordHash;
  return o;
}

function fullRowForDoc(row) {
  return { ...row, assignedCourseLinks: row.assignedCourseLinks || [] };
}

class UserDoc {
  constructor(row) {
    this._row = fullRowForDoc(row);
  }

  get _id() {
    return this._row.id;
  }

  get id() {
    return this._row.id;
  }

  get role() {
    return this._row.role;
  }
  set role(v) {
    this._row.role = v;
  }
  get name() {
    return this._row.name;
  }
  set name(v) {
    this._row.name = v;
  }
  get email() {
    return this._row.email;
  }
  set email(v) {
    this._row.email = v;
  }
  get phone() {
    return this._row.phone;
  }
  set phone(v) {
    this._row.phone = v;
  }
  get passwordHash() {
    return this._row.passwordHash;
  }
  set passwordHash(v) {
    this._row.passwordHash = v;
  }
  get instructorPortfolio() {
    return this._row.instructorPortfolio;
  }
  set instructorPortfolio(v) {
    this._row.instructorPortfolio = v;
  }
  get lastLogin() {
    return this._row.lastLogin;
  }
  set lastLogin(v) {
    this._row.lastLogin = v;
  }

  set(path, val) {
    if (path === 'instructorPortfolio') this._row.instructorPortfolio = val;
    else this._row[path] = val;
  }

  toObject() {
    return leanFromRow(this._row, { stripPassword: false });
  }

  async save() {
    const p = getPrisma();
    await p.user.update({
      where: { id: this._row.id },
      data: {
        role: this._row.role,
        name: this._row.name,
        email: this._row.email,
        phone: this._row.phone,
        passwordHash: this._row.passwordHash,
        parentName: this._row.parentName,
        parentPhone: this._row.parentPhone,
        deviceFingerprints: this._row.deviceFingerprints,
        packageId: this._row.packageId,
        packageExpiry: this._row.packageExpiry,
        ownedBy: this._row.ownedBy,
        instructorPortfolio:
          this._row.instructorPortfolio === undefined
            ? undefined
            : this._row.instructorPortfolio === null
              ? null
              : this._row.instructorPortfolio,
        fcmToken: this._row.fcmToken,
        lastLogin: this._row.lastLogin,
        tenantId: this._row.tenantId,
      },
    });
  }
}

function userInclude() {
  return { assignedCourseLinks: { select: { courseId: true } } };
}

async function findRowById(id, withLinks = true) {
  const uid = asUuid(id);
  if (!uid) return null;
  return getPrisma().user.findUnique({
    where: { id: uid },
    include: withLinks ? userInclude() : undefined,
  });
}

function applySelect(obj, sel) {
  if (!obj || !sel) return obj;
  if (sel === '-passwordHash') {
    const { passwordHash: _p, ...rest } = obj;
    return rest;
  }
  const fields = String(sel)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = {};
  for (const f of fields) {
    if (f.startsWith('-')) continue;
    if (Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  }
  if (!fields.length || fields.some((f) => !f.startsWith('-'))) {
    out._id = obj._id;
  }
  return out;
}

function findById(id) {
  return createFindChain(async (state) => {
    const row = await findRowById(id, true);
    if (!row) return null;
    if (state.lean) {
      let o = leanFromRow(row);
      if (state.selectStr) o = applySelect(o, state.selectStr);
      return o;
    }
    return new UserDoc(row);
  });
}

async function findOneRow(filter) {
  const p = getPrisma();
  const where = mongoUserFilterToPrisma(filter);
  if (where === false) return null;
  return p.user.findFirst({
    where: where || undefined,
    include: userInclude(),
  });
}

function findOne(filter) {
  return createFindChain(async (state) => {
    const row = await findOneRow(filter);
    if (!row) return null;
    if (state.lean) {
      let o = leanFromRow(row);
      if (state.selectStr) o = applySelect(o, state.selectStr);
      return o;
    }
    return new UserDoc(row);
  });
}

function mongoUserFilterToPrisma(filter) {
  if (!filter || !Object.keys(filter).length) return {};
  if (filter.$or) {
    const parts = filter.$or.map((part) => mongoUserFilterToPrisma(part)).filter((x) => x !== false);
    if (!parts.length) return false;
    return { OR: parts };
  }
  const out = {};
  if (filter.email != null) out.email = String(filter.email).trim().toLowerCase();
  if (filter.phone != null) out.phone = String(filter.phone);
  if (filter.role != null) out.role = filter.role;
  if (filter._id != null) {
    const u = asUuid(filter._id);
    if (u) out.id = u;
  }
  return out;
}

function find(filter) {
  return createFindChain(async (state) => {
    const p = getPrisma();
    const where = mongoUserFindToPrismaWhere(filter);
    const orderBy = mongoSortToOrderBy(state.sortObj, { createdAt: 'desc' });
    const take = state.limitN ?? undefined;
    const rows = await p.user.findMany({
      where,
      orderBy,
      take,
      include: userInclude(),
    });
    return rows.map((r) => {
      let o = state.lean ? leanFromRow(r) : new UserDoc(r);
      if (state.lean && state.selectStr) o = applySelect(o, state.selectStr);
      return o;
    });
  });
}

function mongoUserFindToPrismaWhere(filter) {
  if (!filter || !Object.keys(filter).length) return {};
  if (filter.$or) {
    return { OR: filter.$or.map((part) => mongoUserFindToPrismaWhere(part)) };
  }
  const out = {};
  if (filter.role != null) {
    if (filter.role.$in) out.role = { in: filter.role.$in };
    else out.role = filter.role;
  }
  if (filter.ownedBy != null) {
    const u = asUuid(filter.ownedBy);
    if (u) out.ownedBy = u;
  }
  if (filter._id != null && filter._id.$in) {
    const ids = filter._id.$in.map((x) => asUuid(x)).filter(Boolean);
    out.id = { in: ids };
  }
  return out;
}

function mongoSortToOrderBy(sortObj, fallback) {
  if (!sortObj || !Object.keys(sortObj).length) return fallback;
  const [k, dir] = Object.entries(sortObj)[0];
  const prismaKey = k === '_id' ? 'id' : k;
  return { [prismaKey]: dir === -1 ? 'desc' : 'asc' };
}

async function create(data) {
  const p = getPrisma();
  const row = await p.user.create({
    data: {
      role: data.role,
      name: data.name,
      tenantId: data.tenantId ? asUuid(data.tenantId) : undefined,
      email: data.email != null ? String(data.email).trim().toLowerCase() : undefined,
      phone: data.phone,
      passwordHash: data.passwordHash,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      deviceFingerprints: data.deviceFingerprints,
      packageId: data.packageId ? asUuid(data.packageId) : undefined,
      packageExpiry: data.packageExpiry,
      ownedBy: data.ownedBy ? asUuid(data.ownedBy) : undefined,
      instructorPortfolio:
        data.instructorPortfolio === undefined
          ? undefined
          : data.instructorPortfolio === null
            ? null
            : data.instructorPortfolio,
      fcmToken: data.fcmToken,
      lastLogin: data.lastLogin,
    },
    include: userInclude(),
  });
  return new UserDoc(row);
}

async function countDocuments(filter = {}) {
  const where = {};
  if (filter.role != null && typeof filter.role === 'string') {
    where.role = filter.role;
  } else {
    Object.assign(where, mongoUserFindToPrismaWhere(filter));
  }
  return getPrisma().user.count({ where });
}

async function findByIdAndUpdate(id, update) {
  const uid = asUuid(id);
  if (!uid) return null;
  await applyUserUpdate(uid, update);
  return findRowById(uid, true);
}

async function updateMany(filter, update) {
  const p = getPrisma();
  if (filter.email && typeof filter.email === 'string' && update.$set && update.$set.phone !== undefined) {
    const res = await p.user.updateMany({
      where: { email: String(filter.email).toLowerCase() },
      data: { phone: update.$set.phone },
    });
    return { matchedCount: res.count };
  }
  if (filter.email && filter.email.$in && update.$set && update.$set.passwordHash) {
    const res = await p.user.updateMany({
      where: { email: { in: filter.email.$in.map((e) => String(e).toLowerCase()) } },
      data: { passwordHash: update.$set.passwordHash },
    });
    return { matchedCount: res.count };
  }
  if (filter.assignedCourses && filter.assignedCourses.$in && update.$pull && update.$pull.assignedCourses) {
    const courseIds = filter.assignedCourses.$in.map((x) => asUuid(x)).filter(Boolean);
    const pullIds = update.$pull.assignedCourses.$in
      ? update.$pull.assignedCourses.$in.map((x) => asUuid(x)).filter(Boolean)
      : [];
    const targets = pullIds.length ? pullIds : courseIds;
    const del = await p.userAssignedCourse.deleteMany({
      where: { courseId: { in: targets }, userId: { in: courseIds } },
    });
    return { matchedCount: del.count };
  }
  return { matchedCount: 0 };
}

async function updateOne(filter, update) {
  const uid = filter._id != null ? asUuid(filter._id) : null;
  if (!uid) return { matchedCount: 0 };
  await applyUserUpdate(uid, update);
  return { matchedCount: 1 };
}

async function applyUserUpdate(uid, update) {
  const p = getPrisma();
  if (update.$set && update.$set.email !== undefined) {
    await p.user.update({
      where: { id: uid },
      data: { email: String(update.$set.email) },
    });
    return;
  }
  if (update.$set && update.$set.phone !== undefined) {
    await p.user.update({ where: { id: uid }, data: { phone: update.$set.phone } });
    return;
  }
  if (update.$set && Object.keys(update.$set).length) {
    const d = { ...update.$set };
    if (d.packageId != null) d.packageId = asUuid(d.packageId);
    await p.user.update({ where: { id: uid }, data: d });
    return;
  }
  if (update.$addToSet && update.$addToSet.assignedCourses) {
    const cid = asUuid(update.$addToSet.assignedCourses);
    if (cid) {
      await p.userAssignedCourse.upsert({
        where: { userId_courseId: { userId: uid, courseId: cid } },
        create: { userId: uid, courseId: cid },
        update: {},
      });
    }
    return;
  }
  if (update.$pull && update.$pull.assignedCourses) {
    const cid = asUuid(update.$pull.assignedCourses);
    if (cid) {
      await p.userAssignedCourse.deleteMany({ where: { userId: uid, courseId: cid } });
    }
  }
}

const User = {
  ROLES,
  findById,
  findOne,
  find,
  create,
  countDocuments,
  findByIdAndUpdate,
  updateMany,
  updateOne,
};

module.exports = User;
module.exports.ROLES = ROLES;
