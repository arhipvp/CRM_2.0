/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Для production сборки
  output: 'standalone',
}

module.exports = nextConfig
