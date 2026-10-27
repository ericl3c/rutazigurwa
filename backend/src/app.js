
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const { requireCustomHeader } = require("./middleware/auth");

const app = express();
const prod = process.env.NODE_ENV === "production";

// Trust Render's reverse proxy in production.
if (prod) {
  app.set("trust proxy", 1);
}

// Validate production authentication configuration.
if (
  prod &&
  !process.env.AUTH_TOKEN_SECRET &&
  !process.env.SESSION_SECRET
) {
  throw new Error(
    "AUTH_TOKEN_SECRET or SESSION_SECRET is required in production."
  );
}

// Allowed frontend origins.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://rutazigurwa-jyry.vercel.app",
  "https://ericl3c-rutazigurwa.vercel.app",
  "https://rutazigurwa-5cpx.vercel.app",
]
  .filter(Boolean)
  .map((url) => url.replace(/\/+$/, ""));

// Security headers.
app.use(helmet());

// CORS configuration.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked CORS origin:", origin);
      return callback(null, false);
    },
    credentials: false,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Requested-With",
      "Authorization",
    ],
  })
);

// Parse JSON request bodies.
app.use(express.json({ limit: "10kb" }));

// Health check.
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Family Lottery API is running.",
  });
});

// Member and admin API routes.
app.use(
  "/api",
  requireCustomHeader,
  require("./routes/member"),
  require("./routes/admin")
);

// Handle unknown routes.
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
