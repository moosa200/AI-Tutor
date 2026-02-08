/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-parse',
      '@aws-sdk/client-bedrock-runtime',
      '@aws-sdk/core',
      '@smithy/core',
      '@smithy/middleware-retry',
      '@aws-sdk/middleware-logger',
    ],
  },
}

module.exports = nextConfig
