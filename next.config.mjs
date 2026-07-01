/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
    outputFileTracingIncludes: {
      '/api/context': ['./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*'],
    },
  },
};

export default nextConfig;
