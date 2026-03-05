import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signSession, verifySession } from "@/lib/jwt";
import { getBasePath } from "@/lib/basePath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const jar = await cookies();
  const maxAge = 30 * 24 * 3600; // 30 days
  const existing = jar.get("sid")?.value;

  // 检查是否有重定向参数；构造稳定的绝对 URL（NextResponse.redirect 需要绝对地址）
  const url = new URL(req.url);
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const scheme = xfProto || url.protocol.replace(":", "") || "https";
  const authority = xfHost || host || url.host;
  const origin = `${scheme}://${authority}`;
  const basePath = getBasePath();
  const defaultRedirect = basePath ? `${basePath}/` : "/";
  const rawRedirect = url.searchParams.get("redirect") || defaultRedirect;
  const redirectTo = rawRedirect.startsWith("/") ? rawRedirect : defaultRedirect;
  const cookiePath = basePath || "/";

  if (existing) {
    const uid = await verifySession(existing);
    if (uid) {
      const newToken = await signSession(uid, maxAge);
      const res = NextResponse.redirect(new URL(redirectTo, origin));
      res.cookies.set("sid", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: cookiePath,
        maxAge,
      });
      return res;
    }
  }

  const userId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const token = await signSession(userId, maxAge);
  const res = NextResponse.redirect(new URL(redirectTo, origin));
  res.cookies.set("sid", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: cookiePath,
    maxAge,
  });
  return res;
}

