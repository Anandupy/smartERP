import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EduOS',
};

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * Public layout — no authentication required.
 * Minimal layout for maintenance page and other public routes.
 */
export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      {children}
    </div>
  );
}
