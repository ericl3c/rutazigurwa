
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
