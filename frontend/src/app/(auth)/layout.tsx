import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | EduOS',
    default: 'EduOS',
  },
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Auth layout — centered card layout for login and auth flows.
 * No navigation, no sidebar.
 * Renders a full-screen centered container.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface p-4">
      {/* Subtle grid pattern background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
        aria-hidden
      />

      {/* Auth card container */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center text-[11px] text-text-muted">
        EduOS ERP Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
