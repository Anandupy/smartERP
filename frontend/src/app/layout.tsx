import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/core/providers/query-provider';
import { ThemeProvider } from '@/core/providers/theme-provider';
import { ThemeStudioProvider } from '@/core/providers/theme-studio-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    template: '%s | EduOS',
    default: 'EduOS — Educational ERP Platform',
  },
  description:
    'EduOS is a multi-tenant Educational ERP Platform for managing institutions, branches, admissions, and academic operations.',
  keywords: ['ERP', 'Education', 'School Management', 'Admissions'],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0F' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={inter.variable}
      data-density="erp-dense"
    >
      <body>
        <QueryProvider>
          <ThemeProvider>
            <ThemeStudioProvider>
              {children}
              <Toaster
                position="bottom-right"
                richColors
                closeButton
                duration={4000}
                toastOptions={{
                  classNames: {
                    toast: 'text-sm',
                    title: 'font-medium',
                  },
                }}
              />
            </ThemeStudioProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
