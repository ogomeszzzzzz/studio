
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const APP_NAME = "Painel Altenburg";
const APP_DESCRIPTION = "Análise de estoque, dashboards de performance e oportunidades de reabastecimento.";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:9002";


export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_NAME,
      template: `%s - ${APP_NAME}`,
    },
    description: APP_DESCRIPTION,
    url: APP_BASE_URL,
    images: [
      {
        url: `${APP_BASE_URL}/og-image.png`, // Example: /og-image.png in your public folder
        width: 1200,
        height: 630,
        alt: `Preview do ${APP_NAME}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: {
      default: APP_NAME,
      template: `%s - ${APP_NAME}`,
    },
    description: APP_DESCRIPTION,
    images: [`${APP_BASE_URL}/twitter-image.png`], // Example: /twitter-image.png
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background text-foreground`}>
        <AuthProvider> {/* Wrap children with AuthProvider */}
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
