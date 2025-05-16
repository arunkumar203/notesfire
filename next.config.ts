import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false, // Disable build activity indicator
    buildActivityPosition: 'bottom-left',
  },
  poweredByHeader: false, // This will hide the Next.js badge in development

  // ⛔ Disable ESLint checks during production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
