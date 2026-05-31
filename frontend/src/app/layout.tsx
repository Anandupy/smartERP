import type { Metadata, Viewport } from 'next';
import { Inter, Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/core/providers/query-provider';
import { ThemeProvider } from '@/core/providers/theme-provider';
import { ThemeStudioProvider } from '@/core/providers/theme-studio-provider';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
  robots: {
    index: false, // No search indexing for ERP software
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0F' },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Root layout — wraps the entire application.
 *
 * Provider nesting order (important):
 * QueryProvider → ThemeProvider (next-themes) → ThemeStudioProvider → children
 *
 * ThemeProvider must be outside ThemeStudioProvider because ThemeStudioProvider
 * reads the color mode from next-themes context.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
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
                    toast: 'font-sans text-sm',
                    title: 'font-medium',
                    description: 'text-muted-foreground',
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
