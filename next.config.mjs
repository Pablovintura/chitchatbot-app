/** @type {import('next').NextConfig} */
// The public site is plain files in /public. Serve index.html at the root.
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/index.html' }],
    };
  },
};
export default nextConfig;
