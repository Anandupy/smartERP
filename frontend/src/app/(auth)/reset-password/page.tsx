import type { Metadata } from 'next';
import { Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Reset Password | EduOS',
};

/**
 * Reset Password page — shell only.
 * Awaiting backend endpoint implementation (GAP-02).
 */
export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-muted-erp">
          Enter and confirm your new password below.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info-bg px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
        <p className="text-sm text-info">
          This feature is not yet available. Contact your administrator.
        </p>
      </div>

      <div className="rounded-xl border border-erp bg-background p-6 shadow-sm">
        <p className="text-sm text-muted-erp">
          Password reset link not yet implemented.
        </p>
      </div>
    </div>
  );
}
