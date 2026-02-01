// apps/web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // ✅ dev: backend do Nest servindo /uploads
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/uploads/**',
      },
      // ✅ quando por algum motivo vier /api/uploads
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/api/uploads/**',
      },

      // (opcional) se você acessar por 127.0.0.1
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
        pathname: '/api/uploads/**',
      },
    ],
  },

  async redirects() {
    return [
      {
        source: '/loja/:handle',
        destination: '/@:handle',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/s/:code',
        destination: 'http://localhost:3001/api/s/:code',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
