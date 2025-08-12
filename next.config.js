/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  },
}

module.exports = nextConfig