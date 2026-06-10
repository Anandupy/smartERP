import type { Metadata } from 'next';
import { ArrowLeft, Mail, Info } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Forgot Password | EduOS',
};

/**
 * Forgot Password page — shell only.
 *
 * NOTE: The backend does not yet have a forgot-password endpoint (GAP-02).
 * This page is a placeholder. It will be wired up when the endpoint is available.
 * See: docs/auth-strategy.md
 */
export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to sign in
        </Link>
        <div className="pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Enter your email to receive a password reset link.
          </p>
        </div>
      </div>

      {/* Placeholder notice */}
      <div className="flex items-start gap-3 rounded-lg border border-info/20 bg-info-bg px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
        <p className="text-sm text-info">
          Password reset is not yet available. Please contact your system
          administrator to reset your password.
        </p>
      </div>

      {/* Form shell */}
      <div className="rounded-xl border border-erp bg-background p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Mail className="h-4 w-4 text-text-muted" aria-hidden />
              </div>
              <input
                id="email"
                type="email"
                disabled
                placeholder="you@example.com"
                className="w-full rounded-md border border-input bg-surface px-3 py-2 pl-9 text-sm text-text-muted cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground opacity-50"
          >
            Send reset link
          </button>
        </div>
      </div>
    </div>
  );
}
