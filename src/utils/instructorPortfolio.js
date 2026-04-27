/**
 * Shapes stored {@link User.instructorPortfolio} for public course pages (catalog, enrolled class view).
 * Strips junk and caps array lengths.
 */
function publicPortfolioFromDoc(doc) {
  if (!doc || typeof doc !== 'object') {
    return {
      headline: '',
      bio: '',
      avatarUrl: '',
      expertiseTags: [],
      highlights: [],
      links: [],
      galleryUrls: [],
    };
  }
  const highlights = Array.isArray(doc.highlights)
    ? doc.highlights.slice(0, 12).map((h) => ({
        title: String(h?.title || '').trim().slice(0, 200),
        description: String(h?.description || '').trim().slice(0, 2000),
      }))
    : [];
  const links = Array.isArray(doc.links)
    ? doc.links
        .slice(0, 12)
        .map((l) => ({
          label: String(l?.label || '').trim().slice(0, 80),
          url: String(l?.url || '').trim().slice(0, 2000),
        }))
        .filter((l) => l.url)
    : [];
  return {
    headline: String(doc.headline || '').trim().slice(0, 200),
    bio: String(doc.bio || '').trim().slice(0, 12000),
    avatarUrl: String(doc.avatarUrl || '').trim().slice(0, 2000),
    expertiseTags: Array.isArray(doc.expertiseTags)
      ? doc.expertiseTags.map((t) => String(t || '').trim().slice(0, 80)).filter(Boolean).slice(0, 24)
      : [],
    highlights,
    links,
    galleryUrls: Array.isArray(doc.galleryUrls)
      ? doc.galleryUrls.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

/** Payload from PATCH — same caps, omits undefined keys. */
function sanitizePortfolioPatch(body) {
  if (!body || typeof body !== 'object') return {};
  const out = {};
  if ('headline' in body) out.headline = String(body.headline ?? '').trim().slice(0, 200);
  if ('bio' in body) out.bio = String(body.bio ?? '').trim().slice(0, 12000);
  if ('avatarUrl' in body) out.avatarUrl = String(body.avatarUrl ?? '').trim().slice(0, 2000);
  if ('expertiseTags' in body && Array.isArray(body.expertiseTags)) {
    out.expertiseTags = body.expertiseTags
      .map((t) => String(t || '').trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 24);
  }
  if ('highlights' in body && Array.isArray(body.highlights)) {
    out.highlights = body.highlights
      .slice(0, 12)
      .map((h) => ({
        title: String(h?.title ?? '').trim().slice(0, 200),
        description: String(h?.description ?? '').trim().slice(0, 2000),
      }))
      .filter((h) => h.title || h.description);
  }
  if ('links' in body && Array.isArray(body.links)) {
    out.links = body.links
      .slice(0, 12)
      .map((l) => ({
        label: String(l?.label ?? '').trim().slice(0, 80),
        url: String(l?.url ?? '').trim().slice(0, 2000),
      }))
      .filter((l) => l.url);
  }
  if ('galleryUrls' in body && Array.isArray(body.galleryUrls)) {
    out.galleryUrls = body.galleryUrls.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12);
  }
  return out;
}

module.exports = { publicPortfolioFromDoc, sanitizePortfolioPatch };
