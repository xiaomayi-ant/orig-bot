import { cookies } from "next/headers";
import { verifySession } from "@/lib/jwt";

export async function withAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  try {
    const jar = await cookies();
    const headers: Record<string, string> = { ...(extra || {}) };

    // Handle duplicated sid cookies (different paths/domains) by picking
    // the first token that can be verified with current JWT_SECRET.
    const allSid = (jar.getAll?.("sid") || [])
      .map((c: any) => c?.value)
      .filter((v: any) => typeof v === "string" && v.length > 0) as string[];

    for (const token of allSid) {
      const uid = await verifySession(token);
      if (uid) {
        headers["Authorization"] = `Bearer ${token}`;
        return headers;
      }
    }

    const sid = jar.get("sid")?.value;
    if (sid) headers["Authorization"] = `Bearer ${sid}`;
    return headers;
  } catch {
    return { ...(extra || {}) };
  }
}


