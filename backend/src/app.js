require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const pool = require('./db');
const { requireCustomHeader } = require('./middleware/auth');

const prod = process.env.NODE_ENV === 'production';
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(session({
  name: 'sid',
  store: new PgStore({ pool, tableName: 'sessions' }),
  secret: process.env.SESSION_SECRET || (prod ? undefined : 'dev-only-secret'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax', maxAge: 12 * 60 * 60 * 1000 },
}));
app.use('/api', requireCustomHeader, require('./routes/member'), require('./routes/admin'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));
// Central error handler: never leaks stack traces
app.use((err, req, res, next) => {
  if (err.status && err.code) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid request body.' } });
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' } });
});
module.exports = app;
