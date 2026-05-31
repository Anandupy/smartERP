/**
 * Root dashboard loading state.
 * Shown by Next.js during route transitions.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-skeleton rounded bg-surface-2" />
        <div className="h-4 w-64 animate-skeleton rounded bg-surface-2" />
      </div>
      {/* Content skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-skeleton rounded-lg border border-erp bg-surface-2"
          />
        ))}
      </div>
      <div className="h-64 animate-skeleton rounded-lg border border-erp bg-surface-2" />
    </div>
  );
}
