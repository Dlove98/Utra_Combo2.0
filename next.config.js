/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Logos d'équipes hébergés sur GitHub (openfootball) et football-data.org
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
    ],
  },
};

module.exports = nextConfig;
