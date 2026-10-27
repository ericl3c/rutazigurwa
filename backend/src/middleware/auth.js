<<<<<<< HEAD

const jwt = require('jsonwebtoken');
const pool = require('../db');
const { AppError } = require('../errors');

function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(
      new AppError(401, 'UNAUTHORIZED', 'Authentication token required.')
    );
  }

  const token = header.slice(7).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    if (
      !payload.sub ||
      !['admin', 'member'].includes(payload.role)
    ) {
      throw new Error('Invalid token claims');
    }

    req.auth = {
      id: payload.sub,
      role: payload.role
    };

    next();
  } catch (error) {
    next(
      new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired.')
    );
  }
}

function requireAdmin(req, res, next) {
  verifyToken(req, res, (err) => {
    if (err) return next(err);

    if (req.auth.role !== 'admin') {
      return next(
        new AppError(403, 'FORBIDDEN', 'Administrator access required.')
      );
    }

    next();
  });
}

async function requireMember(req, res, next) {
  verifyToken(req, res, async (err) => {
    if (err) return next(err);

    if (req.auth.role !== 'member') {
      return next(
        new AppError(403, 'FORBIDDEN', 'Member access required.')
      );
    }

    try {
      // Recheck the database so a deactivated member loses access.
      const result = await pool.query(
        'SELECT id FROM family_members WHERE id = $1 AND is_active = true',
        [req.auth.id]
      );

      if (!result.rows.length) {
        return next(
          new AppError(401, 'UNAUTHORIZED', 'Member account is inactive.')
        );
      }

      req.member = result.rows[0];
      next();
    } catch (error) {
      next(error);
    }
  });
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireMember
};
=======
const { AppError } = require('../errors');
const pool = require('../db');
const { verifyToken } = require('../services/authToken');

function bearerClaims(req, role) {
  const authorization = req.get('Authorization') || '';
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match ? verifyToken(match[1], role) : null;
}

function requireAdmin(req, res, next) {
  const claims = bearerClaims(req, 'admin');
  if (!claims) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Administrator login required.'));
  }

  req.adminId = claims.id;
  return next();
}

async function requireMember(req, res, next) {
  try {
    const claims = bearerClaims(req, 'member');
    if (!claims) throw new AppError(401, 'TOKEN_EXPIRED', 'Please enter your Member ID again.');
    const r = await pool.query('SELECT id, member_code, full_name, gender, is_active FROM family_members WHERE id=$1', [claims.id]);
    if (!r.rows[0] || !r.rows[0].is_active) throw new AppError(401, 'SESSION_EXPIRED', 'Please enter your Member ID again.');
    req.member = r.rows[0];
    next();
  } catch (e) { next(e); }
}
// Require the app header on mutations; bearer credentials are sent explicitly in Authorization.
function requireCustomHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return req.get('X-Requested-With') === 'family-lottery' ? next() : next(new AppError(403, 'FORBIDDEN', 'Invalid request.'));
}
module.exports = { requireAdmin, requireMember, requireCustomHeader };
>>>>>>> 5315d7ee (Migrate authentication to JWT)
