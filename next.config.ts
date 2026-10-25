import type { NextConfig } from "next";

const auditWebpack: NonNullable<NextConfig["webpack"]> = (config) => {
  config.cache = false;
  return config;
};

const nextConfig: NextConfig = {
  ...(process.env.UI_AUDIT_ISOLATED === "1" ? { webpack: auditWebpack } : {}),
  // Keep the isolated UI audit server separate from the user's running app.
  distDir:
    process.env.UI_AUDIT_ISOLATED === "1" && process.env.UI_AUDIT_PRODUCTION !== "1"
      ? ".local-backups/ui-audit-next"
      : ".next",
  devIndicators: process.env.UI_AUDIT_ISOLATED === "1" ? false : undefined,
  allowedDevOrigins: ["192.168.1.10", "127.0.0.1"],
  // Avoid multi-gigabyte development cache compactions on the local low-space drive.
  experimental: {
    turbopackFileSystemCacheForDev: false,
    // Reuse visited pages in this browser tab; private data is not server-cached.
    staleTimes: { dynamic: 60, static: 60 },
  },
  // pdfkit reads its built-in font metrics (.afm files) from disk at
  // runtime using paths relative to its own package folder. Left to the
  // default bundler, Next.js rewrites __dirname during compilation, so
  // that lookup resolves to a path that doesn't exist and PDF report
  // generation fails with ENOENT for Helvetica.afm. Excluding it from
  // bundling makes the route load it via a normal require() from
  // node_modules instead, where its real file layout is intact.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
