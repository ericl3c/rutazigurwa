
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { AppError } = require('../errors');

// Verify the JWT sent by the frontend.
function verifyToken(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const match = /^Bearer ([^\s]+)$/.exec(authorization);

  if (!match) {
    return next(
      new AppError(401, 'UNAUTHORIZED', 'Authentication token required.')
    );
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (
      !payload.sub ||
      !['admin', 'member'].includes(payload.role)
    ) {
      throw new Error('Invalid token claims');
    }

    req.auth = {
      id: payload.sub,
      role: payload.role,
    };

    return next();
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') {
      return next(error);
    }

    return next(
      new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired.')
    );
  }
}

// Allow administrators only.
function requireAdmin(req, res, next) {
  return verifyToken(req, res, (err) => {
    if (err) return next(err);

    if (req.auth.role !== 'admin') {
      return next(
        new AppError(403, 'FORBIDDEN', 'Administrator access required.')
      );
    }

    req.adminId = req.auth.id;
    return next();
  });
}

// Allow active members only.
function requireMember(req, res, next) {
  return verifyToken(req, res, async (err) => {
    if (err) return next(err);

    if (req.auth.role !== 'member') {
      return next(
        new AppError(403, 'FORBIDDEN', 'Member access required.')
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
          new AppError(401, 'UNAUTHORIZED', 'Member account is inactive.')
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