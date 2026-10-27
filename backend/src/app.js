
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const { requireCustomHeader } = require("./middleware/auth");

const app = express();
const prod = process.env.NODE_ENV === "production";

// Configure Render's reverse proxy before registering middleware.
app.set("trust proxy", prod ? 1 : false);

console.log("Express trust proxy:", app.get("trust proxy"));
console.log("NODE_ENV:", process.env.NODE_ENV);

// Validate production authentication configuration.
if (
  prod &&
  !process.env.JWT_SECRET &&
  !process.env.AUTH_TOKEN_SECRET &&
  !process.env.SESSION_SECRET
) {
  throw new Error(
    "JWT_SECRET, AUTH_TOKEN_SECRET, or SESSION_SECRET is required in production."
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

app.use(helmet());

// CORS configuration.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("Blocked CORS origin:", origin);
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

  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      error: {
        code: "CORS_BLOCKED",
        message: "This frontend origin is not allowed.",
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
