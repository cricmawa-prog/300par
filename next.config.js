/** @type {import('next').NextConfig} */
const nextConfig = {
  // Baseline browser hardening for every page. (A strict Content-Security-Policy is deliberately not set
  // here: it needs an allow-list for Firebase, Google sign-in, Vercel Analytics and the Font Awesome
  // stylesheet and is worth doing as its own change, tested in a browser.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' }, // nobody can frame the site (clickjacking)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }, // keeps Google sign-in popups working
        ],
      },
    ];
  },
};

module.exports = nextConfig;
