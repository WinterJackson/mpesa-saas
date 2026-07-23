import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification builds can set NEXT_BUILD_DIST_DIR (e.g. .next-verify) so a
  // production build never churns a running `next dev` server's shared `.next`
  // directory (which otherwise pushes continuous HMR full-page reloads to any
  // open browser tab). Unset in normal dev/prod → defaults to `.next`.
  ...(process.env.NEXT_BUILD_DIST_DIR ? { distDir: process.env.NEXT_BUILD_DIST_DIR } : {}),
  serverExternalPackages: ['@prisma/client'],
  images: {
    qualities: [75, 90],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "payswift",
  project: "mpesa-saas",
});
