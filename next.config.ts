
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Ensures static HTML export
  
  // If deploying to a subpath on GitHub Pages (e.g., your-username.github.io/your-repo-name),
  // you might need to uncomment and set basePath:
  // basePath: '/your-repo-name', 

  typescript: {
    // Recommended to resolve TypeScript errors before building
    ignoreBuildErrors: true, 
  },
  eslint: {
    // Recommended to resolve ESLint issues before building
    ignoreDuringBuilds: true, 
  },
  images: {
    // Required for static export if using next/image
    unoptimized: true, 
  },
  
  // Server Actions are not supported with `output: 'export'`
  // experimental: {
  //   serverActions: true, 
  // },
};

export default nextConfig;
