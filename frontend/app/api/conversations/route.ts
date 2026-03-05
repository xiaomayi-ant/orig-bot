import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuthHeaders } from "@/lib/withAuthHeaders";
import { randomUUID } from "node:crypto";
import { signSession } from "@/lib/jwt";
import { getBasePath } from "@/lib/basePath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// GET /api/conversations?cursor=updatedAtIso|id&take=30
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const takeParam = searchParams.get("take");
    const cursorParam = searchParams.get("cursor");
    const headers = await withAuthHeaders();
    const sid = (headers["Authorization"] || "").replace(/^Bearer\s+/i, "");
    const userId = sid ? await (await import("@/lib/jwt")).verifySession(sid) : null;

    const take = Math.min(Math.max(Number(takeParam || 30) || 30, 1), 100);

    let cursorUpdatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (cursorParam) {
      const [ts, id] = cursorParam.split("|");
      if (ts && id) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          cursorUpdatedAt = d;
          cursorId = id;
        }
      }
    }

    // 必须有 userId 才返回列表，避免潜在越权
    if (!userId) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const whereBase: any = { archived: false, userId };

    const where = cursorUpdatedAt && cursorId
      ? {
          ...whereBase,
          OR: [
            { updatedAt: { lt: cursorUpdatedAt } },
            { AND: [{ updatedAt: cursorUpdatedAt }, { id: { lt: cursorId } }] },
          ],
        }
      : whereBase;  // 不显示已归档的会话

    const items = await prisma.conversation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      select: { id: true, title: true, updatedAt: true },
    });

    let nextCursor: string | null = null;
    if (items.length > take) {
      const last = items[take];
      nextCursor = `${last.updatedAt.toISOString()}|${last.id}`;
      items.length = take;
    }

    return NextResponse.json({
      items,
      nextCursor,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title: string = (typeof body?.title === "string" && body.title.trim()) || "新聊天";
    const headers = await withAuthHeaders();
    let sid = (headers["Authorization"] || "").replace(/^Bearer\s+/i, "");
    let userId = sid ? await (await import("@/lib/jwt")).verifySession(sid) : null;
    let issuedSid: string | null = null;

    // Bootstrap guest session when cookie is missing/invalid (common in first-load incognito).
    if (!userId) {
      userId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      issuedSid = await signSession(userId, 30 * 24 * 3600);
      sid = issuedSid;
    }

    // 创建 threadId（服务端调用 LangGraph）
    async function createServerThread(): Promise<string | null> {
      try {
        const rawBase = (process.env["LANGGRAPH_API_URL"] || "").replace(/\/$/, "");
        const base = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;
        if (!base) return null;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-api-key": process.env["LANGCHAIN_API_KEY"] || "",
        };
        if (sid) headers["Authorization"] = `Bearer ${sid}`;
        const res = await fetch(`${base}/threads`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const id = data?.thread_id || data?.id || null;
        return typeof id === "string" ? id : null;
      } catch {
        return null;
      }
    }

    const threadIdReq = (typeof body?.threadId === "string" && body.threadId) || null;
    const threadId = threadIdReq ?? (await createServerThread());

    if (!threadId) {
      return NextResponse.json({ error: "Failed to create thread" }, { status: 502 });
    }

    const conv = await prisma.conversation.create({
      data: {
        id: randomUUID(),
        title,
        threadId: threadId ?? null,
        updatedAt: new Date(),
        userId: userId || undefined,
      },
      select: { id: true, title: true, updatedAt: true, threadId: true },
    });

    const res = NextResponse.json(conv, { status: 201 });
    if (issuedSid) {
      res.cookies.set("sid", issuedSid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: getBasePath() || "/",
        maxAge: 30 * 24 * 3600,
      });
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Internal Server Error" }, { status: 500 });
  }
}


