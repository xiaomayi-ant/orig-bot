import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeBasePath(value) {
  const raw = (value || "").trim();
  if (!raw || raw === "/") return "";
  const trimmed = raw.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_BASE_PATH || "/smart-bot");

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  output: "standalone",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath || "",
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

export default nextConfig;
