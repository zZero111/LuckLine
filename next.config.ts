import type { NextConfig } from "next";

// Static export for GitHub Pages. The deploy workflow sets NEXT_PUBLIC_BASE_PATH
// to "/RNGdle-2"; leave it empty for local development at http://localhost:3000.
// GitHub Pages cannot send custom HTTP headers, so the Content-Security-Policy
// is set with a <meta> tag in app/layout.tsx instead.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
