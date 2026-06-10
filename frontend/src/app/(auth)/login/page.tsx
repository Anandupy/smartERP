import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { LoginForm } from '@/modules/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Sign In | EduOS',
  description: 'Sign in to your EduOS account',
};

/**
 * Login page — entry point for all users.
 * Server Component — only the LoginForm is a Client Component.
 */
export default function LoginPage() {
  return (
    <div className="space-y-6">
      {/* Logo / Brand */}
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to EduOS
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Sign in to your institution&apos;s ERP portal
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <LoginForm />
      </div>

      {/* Support Link */}
      <p className="text-center text-[11px] text-text-muted">
        Having trouble?{' '}
        <a
          href="mailto:support@eduos.in"
          className="underline-offset-4 hover:underline"
        >
          Contact your administrator
        </a>
      </p>
    </div>
  );
}
