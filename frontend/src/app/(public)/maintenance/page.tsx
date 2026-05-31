import type { Metadata } from 'next';
import { Construction } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Maintenance | EduOS',
};

/**
 * Maintenance page — shown when system maintenance mode is active.
 * No auth required. Redirected to from middleware when flag is set.
 */
export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-bg">
        <Construction className="h-8 w-8 text-warning" aria-hidden />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          System Maintenance
        </h1>
        <p className="text-muted-foreground">
          EduOS is currently undergoing scheduled maintenance. We&apos;ll be
          back shortly. Thank you for your patience.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        If you need urgent assistance, contact your system administrator.
      </p>
    </div>
  );
}
