import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its built-in font metrics (.afm files) from disk at
  // runtime using paths relative to its own package folder. Left to the
  // default bundler, Next.js rewrites __dirname during compilation, so
  // that lookup resolves to a path that doesn't exist and PDF report
  // generation fails with ENOENT for Helvetica.afm. Excluding it from
  // bundling makes the route load it via a normal require() from
  // node_modules instead, where its real file layout is intact.
  serverExternalPackages: ["pdfkit"],
};
module.exports = {
  allowedDevOrigins: ['192.168.1.10'],
}

export default nextConfig;
