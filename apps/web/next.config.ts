import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@carerota/ui', '@carerota/domain', '@carerota/types'],
  // Anthropic SDK uses node: protocol modules — keep it server-side only
  serverExternalPackages: ['@anthropic-ai/sdk'],
}

export default nextConfig
