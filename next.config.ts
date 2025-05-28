
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export', // Adicionado para exportação estática
  basePath: '/studio', // Configurado para o nome do repositório no GitHub Pages
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    unoptimized: true, // Adicionado para exports estáticos
  },
  // experimental: {
  //   serverActions: true, // Server actions não são suportadas em 'output: export'
  // },
};

export default nextConfig;
