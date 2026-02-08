/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'mupdf',
      'sharp',
    ],
  },
}

module.exports = nextConfig
