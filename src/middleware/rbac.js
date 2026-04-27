function authorize(allowedRoles) {
  const set = new Set(allowedRoles);
  return (req, res, next) => {
    if (!req.user) {
      const e = new Error('Unauthorized');
      e.status = 401;
      next(e);
      return;
    }
    if (!set.has(req.user.role)) {
      const e = new Error('Forbidden');
      e.status = 403;
      next(e);
      return;
    }
    next();
  };
}

module.exports = { authorize };
