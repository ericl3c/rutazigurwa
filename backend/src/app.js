
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);

const pool = require("./db");
const { requireCustomHeader } = require("./middleware/auth");

const app = express();
const prod = process.env.NODE_ENV === "production";

// Render runs behind a reverse proxy.
if (prod) {
  app.set("trust proxy", 1);
}

// Validate production configuration.
if (prod && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production.");
}

// Allowed frontend URLs.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://ericl3c-rutazigurwa.vercel.app",
  "https://rutazigurwa-5cpx.vercel.app",
]
  .filter(Boolean)
  .map((url) => url.replace(/\/+$/, ""));

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked CORS origin:", origin);
      return callback(null, false);
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

// PostgreSQL-backed sessions.
app.use(
  session({
    name: "sid",
    store: new PgStore({
      pool,
      tableName: "session",
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

// Health check.
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Family Lottery API is running.",
  });
});

// API routes.
app.use(
  "/api",
  requireCustomHeader,
  require("./routes/member"),
  require("./routes/admin")
);

// 404 handler.
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "BAD_JSON",
        message: "Invalid JSON request body.",
      },
    });
  }

  if (err.status && err.code) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  console.error("API error:", err);

  return res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    },
  });
});

module.exports = app;
