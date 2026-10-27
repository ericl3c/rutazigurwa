
const pool = require('../db');
const { AppError } = require('../errors');
const { verifyToken: verifyAccessToken } = require('../services/authToken');

// Verify the bearer token sent by the frontend.
function verifyToken(req, res, next) {
  const authorization = (req.get('Authorization') || '').trim();
  const parts = authorization.split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== 'bearer' ||
    !parts[1]
  ) {
    return next(
      new AppError(
        401,
        'UNAUTHORIZED',
        'Authentication token required.'
      )
    );
  }

  try {
    const admin = verifyAccessToken(parts[1], 'admin');
    const member = admin
      ? null
      : verifyAccessToken(parts[1], 'member');

    const verified = admin
      ? { ...admin, role: 'admin' }
      : member
        ? { ...member, role: 'member' }
        : null;

    if (!verified || !verified.id) {
      return next(
        new AppError(
          401,
          'INVALID_TOKEN',
          'Token is invalid or expired.'
        )
      );
    }

    req.auth = verified;
    return next();
  } catch (error) {
    return next(error);
  }
}

// Allow administrators only.
function requireAdmin(req, res, next) {
  return verifyToken(req, res, (err) => {
    if (err) {
      return next(err);
    }

    if (req.auth.role !== 'admin') {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          'Administrator access required.'
        )
      );
    }

    req.adminId = req.auth.id;
    return next();
  });
}

// Allow active members only.
function requireMember(req, res, next) {
  return verifyToken(req, res, async (err) => {
    if (err) {
      return next(err);
    }

    if (req.auth.role !== 'member') {
      return next(
        new AppError(
          403,
          'FORBIDDEN',
          'Member access required.'
        )
      );
    }

    try {
      const result = await pool.query(
        `SELECT id, member_code, full_name, gender, is_active
         FROM family_members
         WHERE id = $1 AND is_active = true`,
        [req.auth.id]
      );

      if (!result.rows.length) {
        return next(
          new AppError(
            401,
            'UNAUTHORIZED',
            'Member account is inactive.'
          )
        );
      }

      req.member = result.rows[0];
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

// Require the expected header for non-read-only requests.
function requireCustomHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  if (req.get('X-Requested-With') === 'family-lottery') {
    return next();
  }

  return next(
    new AppError(403, 'FORBIDDEN', 'Invalid request.')
  );
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireMember,
  requireCustomHeader,
};
