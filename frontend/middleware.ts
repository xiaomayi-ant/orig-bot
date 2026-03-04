import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BASE_PATH = "/smart-bot";

export const config = {
  matcher: ["/smart-bot/:path*"],
};

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

    const sid = req.cookies.get("sid")?.value;
    if (!sid) {
      // 没有 sid 时，先重定向到 guest 接口获取 cookie
      const guestUrl = new URL(`${BASE_PATH}/api/auth/guest`, req.nextUrl.origin);
      guestUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
      return NextResponse.redirect(guestUrl);
    }
  } catch {}
  return NextResponse.next();
}
