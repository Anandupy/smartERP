import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center bg-surface">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
        <FileQuestion className="h-8 w-8 text-muted-erp" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-xl font-medium text-foreground">Page not found</p>
        <p className="text-sm text-muted-erp max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to access it.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
