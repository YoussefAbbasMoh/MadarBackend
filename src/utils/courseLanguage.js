const LANGUAGES = ['ar', 'en', 'bilingual'];

/**
 * Course.language is an array of enum values. Coerce client input so Mongoose never rejects saves.
 */
function normalizeCourseLanguage(input) {
  const allowed = new Set(LANGUAGES);
  const raw = Array.isArray(input) ? input : [];
  const out = raw
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((x) => allowed.has(x));
  if (out.length) return [...new Set(out)];
  return ['en'];
}

module.exports = { normalizeCourseLanguage, LANGUAGES };
