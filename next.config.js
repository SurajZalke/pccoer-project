/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...existing config...
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  }
}

module.exports = nextConfig