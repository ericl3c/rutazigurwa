```javascript
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);

const pool = require("./db");
const { requireCustomHeader } = require("./middleware/auth");

const prod = process.env.NODE_ENV === "production";
const app = express();

// Render runs behind a reverse proxy.
if (prod) {
  app.set("trust proxy", 1);
}

// Do not start production with a missing session secret.
if (prod && !process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is required in production."
  );
}

// Configure allowed frontend origins.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://ericl3c-rutazigurwa.vercel.app",
  "https://rutazigurwa-5cpx.vercel.app",
].filter(Boolean);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Requested-With",
      "Authorization",
    ],
  })
);

app.use(express.json({ limit: "10kb" }));

// Store sessions in PostgreSQL.
app.use(
  session({
    name: "sid",
    store: new PgStore({
      pool,
      tableName: "sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-only-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? "none" : "lax",
      maxAge: 12 * 60 * 60 * 1000,
    },
  })
);

// API routes.
app.use(
  "/api",
  requireCustomHeader,
  require("./routes/member"),
  require("./routes/admin")
);

// Health check.
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Not found.
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Not found.",
    },
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.status && err.code) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "BAD_JSON",
        message: "Invalid request body.",
      },
    });
  }

  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      error: {
        code: "CORS_FORBIDDEN",
        message: "This frontend origin is not allowed.",
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    },
  });
});

module.exports = app;
```
