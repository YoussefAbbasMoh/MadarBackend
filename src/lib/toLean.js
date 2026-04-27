/**
 * Map Prisma records (id) to API shapes that still use Mongo-style `_id` for JSON compatibility.
 */

function withId(row) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { _id: id, id, ...rest };
}

function courseWithLegacyArrays(c) {
  if (!c) return null;
  const base = withId(c);
  const enrollments = c.enrollments || [];
  const assistants = c.assistants || [];
  return {
    ...base,
    enrolledStudentIds: enrollments.map((e) => e.studentId),
    assistants: assistants.map((a) => ({
      userId: a.userId,
      permissions: a.permissions || [],
    })),
  };
}

module.exports = { withId, courseWithLegacyArrays };
