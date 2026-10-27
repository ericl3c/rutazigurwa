const BASE = (
  process.env.REACT_APP_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "")
).replace(/\/+$/, "");

const HEADERS = {
  "Content-Type": "application/json",
  "X-Requested-With": "family-lottery",
};

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

  try {
    res = await fetch(BASE + "/api" + path, {
      method,
      headers: { ...HEADERS },
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError(
      0,
      "NETWORK",
      "Cannot reach the server. Check your internet connection and try again."
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
      data.error?.code || data.code || "REQUEST_FAILED",
      data.error?.message ||
        data.message ||
        (res.status === 401
          ? "Administrator login required. Please log in again."
          : "Something went wrong. Please try again.")
    );
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
