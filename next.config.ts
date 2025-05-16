import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    // ⚠️ Removed deprecated `buildActivity`
    position: 'bottom-left', // ✅ Updated from `buildActivityPosition`
  },

  poweredByHeader: false,

  eslint: {
    ignoreDuringBuilds: true, // ✅ This disables ESLint errors in production
  },
};

export default nextConfig;
