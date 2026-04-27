const User = require('../models/User');
const { verifyAccessToken } = require('../utils/jwt');
const { isValidUuid } = require('../lib/ids');
const { isPlatformRole } = require('../constants/mudarRoles');
const { markPlatformAdminSkipTenantScope } = require('../context/tenantQueryScope');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      const e = new Error('Missing or invalid Authorization header (expected: Bearer <accessToken>)');
      e.status = 401;
      throw e;
    }
    const token = header.slice('Bearer '.length).trim();
    const decoded = verifyAccessToken(token);
    const sub = decoded && decoded.sub != null ? String(decoded.sub) : '';
    if (!isValidUuid(sub)) {
      const e = new Error('Invalid access token');
      e.status = 401;
      throw e;
    }
    const user = await User.findById(sub).lean();
    if (!user) {
      const e = new Error('Unauthorized');
      e.status = 401;
      throw e;
    }
    req.user = { ...user, _id: user._id };
    if (isPlatformRole(req.user.role)) {
      markPlatformAdminSkipTenantScope();
    }
    next();
  } catch (err) {
    // Preserve explicit 401 from this middleware (missing/invalid header or unknown user).
    if (err && typeof err.status === 'number' && err.message === 'Unauthorized') {
      next(err);
      return;
    }
    // JWT verify throws TokenExpiredError / JsonWebTokenError — surface cause instead of a generic message.
    const name = err && err.name;
    const message =
      name === 'TokenExpiredError'
        ? 'Access token expired'
        : name === 'JsonWebTokenError' || name === 'NotBeforeError'
          ? 'Invalid access token'
          : err && err.message
            ? String(err.message)
            : 'Unauthorized';
    const e = new Error(message);
    e.status = 401;
    next(e);
  }
}

module.exports = { authenticate };
