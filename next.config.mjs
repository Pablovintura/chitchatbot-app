/** @type {import('next').NextConfig} */
// The public site is plain files in /public. Serve index.html at the root.
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/dashboard', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/index.html' }],
    };
  },
};
export default nextConfig;
