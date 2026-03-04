const DEFAULT_BASE_PATH = "/smart-bot";

function normalizeBasePath(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw || raw === "/") return "";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

export function getBasePath(): string {
  return normalizeBasePath(
    process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_BASE_PATH || DEFAULT_BASE_PATH,
  );
}

export function withBasePath(path: string): string {
  if (!path) return getBasePath() || "/";

  // Absolute URL should pass through untouched.
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const basePath = getBasePath();

  if (!basePath) return normalizedPath;
  if (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}

export function apiPath(path: string): string {
  const normalized = path.startsWith("/api")
    ? path
    : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return withBasePath(normalized);
}
