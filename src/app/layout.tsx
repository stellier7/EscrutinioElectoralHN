import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { GlobalToast } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Escrutinio Transparente',
  description: 'Sistema de registro, verificación y transmisión de resultados electorales',
  keywords: 'elecciones, escrutinio, transparencia, resultados electorales',
  authors: [{ name: 'Escrutinio Transparente Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Escrutinio Transparente',
    description: 'Sistema de registro, verificación y transmisión de resultados electorales',
    type: 'website',
    locale: 'es_ES',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/hnFlag.png" />
      </head>
      <body className={`${inter.className} min-h-screen bg-gray-50 antialiased`}>
        <AuthProvider>
          <div id="root">
            {children}
          </div>
          <div id="modal-root" />
          <GlobalToast />
        </AuthProvider>
      </body>
    </html>
  );
} 