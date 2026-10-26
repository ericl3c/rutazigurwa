
const BASE = (
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : "")
).replace(/\/+$/, "");

const HEADERS = {
  "Content-Type": "application/json",
  "X-Requested-With": "family-lottery",
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  let res;

  // Use the same storage key that your login code uses.
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("authToken");

  const headers = { ...HEADERS };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    res = await fetch(BASE + "/api" + path, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK",
      "Cannot reach the server. Check your internet and try again."
    );
  }

  if (
    res.ok &&
    res.headers.get("content-type")?.includes("text/csv")
  ) {
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error?.code,
      data.error?.message || "Something went wrong."
    );
  }

  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b || {}),
  patch: (p, b) => request("PATCH", p, b || {}),
  blob: (p) => request("GET", p),
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString() : "";
