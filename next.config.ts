import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false, // Disable build activity indicator
    buildActivityPosition: 'bottom-left',
  },
  // This will hide the Next.js badge in development
  poweredByHeader: false,
};

export default nextConfig;
