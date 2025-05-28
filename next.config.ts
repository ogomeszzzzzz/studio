
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Adicionado para exportação estática
  // basePath: '/studio', // REMOVIDO - GitHub Pages lida com o nome do repositório como base path
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // remotePatterns for placehold.co removed as it's not actively used.
    unoptimized: true, // Adicionado para exports estáticos
  },
  // experimental: {
  //   serverActions: true, // Server actions não são suportadas em 'output: export'
  // },
};

export default nextConfig;
