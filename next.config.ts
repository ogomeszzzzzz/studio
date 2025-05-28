
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // output: 'export', // REMOVED: No longer exporting statically
  
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
    // unoptimized: true, // REMOVED: Allow Next.js server to optimize images
  },
  
  // Server Actions are not supported with `output: 'export'`
  // experimental: {
  //   serverActions: true, 
  // },
};

export default nextConfig;
