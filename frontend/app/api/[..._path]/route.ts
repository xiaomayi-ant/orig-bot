import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function handleRequest(req: NextRequest, method: string) {
  try {
    const marker = "/api/";
    const idx = req.nextUrl.pathname.indexOf(marker);
    if (idx < 0) {
      return NextResponse.json({ error: "Invalid API path" }, { status: 400 });
    }
    const path = req.nextUrl.pathname.slice(idx + marker.length);
    
    // 排除特定的端点，这些由前端处理
    if (path.startsWith("upload") || path.startsWith("files/")) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }
    
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    const authHeader = req.headers.get("authorization");
    const sid = req.cookies.get("sid")?.value;
    const forwardAuth = authHeader || (sid ? `Bearer ${sid}` : "");
    const contentType = req.headers.get("content-type") || "";

    const options: RequestInit = {
      method,
      headers: {
        "x-api-key": process.env["LANGCHAIN_API_KEY"] || "",
        ...(forwardAuth ? { Authorization: forwardAuth } : {}),
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
    };

    if (["POST", "PUT", "PATCH"].includes(method)) {
      options.body = await req.text();
    }

    const res = await fetch(
      `${process.env["LANGGRAPH_API_URL"]}/${path}${queryString}`,
      options,
    );

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...res.headers,
        ...getCorsHeaders(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export const GET = (req: NextRequest) => handleRequest(req, "GET");
export const POST = (req: NextRequest) => handleRequest(req, "POST");
export const PUT = (req: NextRequest) => handleRequest(req, "PUT");
export const PATCH = (req: NextRequest) => handleRequest(req, "PATCH");
export const DELETE = (req: NextRequest) => handleRequest(req, "DELETE");

// Add a new OPTIONS handler
export const OPTIONS = () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
    },
  });
};
