
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

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
const APP_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://altenburg.example.com"; // Fallback URL

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json", // Você pode querer adicionar um manifest.json no futuro
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
    // startupImage: [], // Para splash screens em iOS
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
    url: APP_URL,
    images: [
      {
        url: "https://placehold.co/1200x630.png?text=Painel+Altenburg", // Substitua pela URL da sua imagem
        width: 1200,
        height: 630,
        alt: `Preview do ${APP_NAME}`,
        // Adicione um data-ai-hint aqui se você quiser que eu gere uma imagem depois
        // Ex: Adicionar o atributo data-ai-hint="business dashboard analytics" ao elemento img correspondente se for renderizar uma tag <img/>
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
    // site: "@SeuTwitterHandle", // Se você tiver um
    // creator: "@CriadorTwitterHandle", // Se aplicável
    images: ["https://placehold.co/1200x630.png?text=Painel+Altenburg"], // Substitua pela URL da sua imagem
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
