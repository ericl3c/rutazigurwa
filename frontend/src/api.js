const BASE = (
  process.env.REACT_APP_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "")
).replace(/\/+$/, "");

const HEADERS = {
  "Content-Type": "application/json",
  "X-Requested-With": "family-lottery",
};

const TOKEN_KEYS = {
  admin: "rutazigurwa.adminToken",
  member: "rutazigurwa.memberToken",
};

function authScope(path) {
  if (path.startsWith("/admin/")) return "admin";
  if (path.startsWith("/member/") || path === "/lottery/draw") return "member";
  return null;
}

function isPublicAuthPath(path) {
  return ["/admin/login", "/member/login", "/member/register"].includes(path);
}

export function clearAuthToken(scope) {
  window.sessionStorage.removeItem(TOKEN_KEYS[scope]);
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  let res;
  const scope = authScope(path);
  const token = scope && !isPublicAuthPath(path)
    ? window.sessionStorage.getItem(TOKEN_KEYS[scope])
    : null;

  try {
    res = await fetch(BASE + "/api" + path, {
      method,
      headers: {
        ...HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "omit",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError(
      0,
      "NETWORK",
      "Cannot reach the server. Check your internet connection and try again."
    );
  }

  if (res.ok && res.headers.get("content-type")?.includes("text/csv")) {
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && scope) {
      clearAuthToken(scope);
    }

    throw new ApiError(
      res.status,
      data.error?.code || data.code || "REQUEST_FAILED",
      data.error?.message ||
        data.message ||
        (res.status === 401
          ? "Administrator login required. Please log in again."
          : "Something went wrong. Please try again.")
    );
  }

  if (path === "/admin/login" || path === "/member/login") {
    const loginScope = path === "/admin/login" ? "admin" : "member";
    if (typeof data.access_token !== "string" || !data.access_token) {
      throw new ApiError(500, "AUTH_TOKEN_MISSING", "The server did not return an authentication token.");
    }
    window.sessionStorage.setItem(TOKEN_KEYS[loginScope], data.access_token);
  } else if (path === "/admin/logout") {
    clearAuthToken("admin");
  } else if (path === "/member/logout") {
    clearAuthToken("member");
  }

  return data;
}

export const api = {
  get: (path) => request("GET", path),

  post: (path, body) =>
    request("POST", path, body === undefined ? {} : body),

  patch: (path, body) =>
    request("PATCH", path, body === undefined ? {} : body),

  blob: (path) => request("GET", path),
};

export const fmtDate = (date) =>
  date ? new Date(date).toLocaleString() : "";
