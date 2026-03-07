import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASE_PATH = "/smart-bot";

export const config = {
  matcher: ["/smart-bot/:path*"],
};

// Simple in-memory rate limiter for unauthenticated redirect storms (scanners/bots).
// Key = IP, value = { count, resetAt }
const unauthHits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30; // max guest redirects per IP per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = unauthHits.get(ip);
  if (!entry || now > entry.resetAt) {
    unauthHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

// Periodically clean up stale entries to prevent memory leak
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < RATE_WINDOW_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of unauthHits) {
    if (now > entry.resetAt) unauthHits.delete(ip);
  }
}

export async function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname;
    const isStaticAsset =
      pathname.startsWith(`${BASE_PATH}/_next/`) ||
      pathname.startsWith(`${BASE_PATH}/static/`) ||
      pathname.startsWith(`${BASE_PATH}/public/`);
    if (isStaticAsset) return NextResponse.next();

    const authApiPrefix = `${BASE_PATH}/api/auth/`;
    if (pathname.startsWith(authApiPrefix)) return NextResponse.next();

    // Block common scanner/exploit paths early to avoid wasting resources
    const lower = pathname.toLowerCase();
    if (
      lower.includes("..") ||
      lower.includes("wp-") ||
      lower.includes("php") ||
      lower.includes(".env") ||
      lower.includes("cgi-bin")
    ) {
      return new NextResponse(null, { status: 404 });
    }

    const sid = req.cookies.get("sid")?.value;
    if (!sid) {
      maybeCleanup();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
      if (isRateLimited(ip)) {
        return new NextResponse("Too Many Requests", { status: 429 });
      }
      // 没有 sid 时，先重定向到 guest 接口获取 cookie
      const guestUrl = new URL(`${BASE_PATH}/api/auth/guest`, req.nextUrl.origin);
      guestUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
      return NextResponse.redirect(guestUrl);
    }
  } catch {}
  return NextResponse.next();
}
