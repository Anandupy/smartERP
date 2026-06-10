import { redirect } from 'next/navigation';

/**
 * Root route — redirect to dashboard.
 * The middleware handles unauthenticated users (redirects to /login).
 */
export default function RootPage() {
  redirect('/dashboard');
}
