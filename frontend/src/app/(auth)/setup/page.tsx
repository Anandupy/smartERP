import type { Metadata } from 'next';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { SETUP_STEPS } from '@/core/guards/setup-guard';

export const metadata: Metadata = {
  title: 'System Setup | EduOS',
};

/**
 * Setup wizard page — shown to SUPER_ADMIN during initial configuration.
 *
 * This is the foundation shell. Individual steps will be wired to
 * their respective API endpoints as modules are built in Phase 2.
 *
 * Access: SUPER_ADMIN only (enforced by middleware + role check).
 */
export default function SetupPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome to EduOS Setup
        </h1>
        <p className="text-sm text-text-muted">
          Complete these steps to get your ERP platform ready.
        </p>
      </div>

      {/* Progress Card */}
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Setup Progress</span>
            <span className="text-text-muted">0 of {SETUP_STEPS.filter(s => s.isRequired).length} required steps</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: '0%' }}
              role="progressbar"
              aria-valuenow={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Setup progress"
            />
          </div>
        </div>

        {/* Steps */}
        <ol className="space-y-3" aria-label="Setup steps">
          {SETUP_STEPS.map((step, index) => (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-lg border border-border p-4"
            >
              {/* Step icon */}
              <div className="mt-0.5 shrink-0">
                {step.isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5 text-text-muted" aria-hidden />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {index + 1}. {step.title}
                  </span>
                  {!step.isRequired && (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                      Optional
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  {step.description}
                </p>
              </div>

              {/* Action */}
              <button
                disabled
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-50 cursor-not-allowed"
                aria-label={`Start step: ${step.title}`}
              >
                Start
                <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-center text-xs text-text-muted">
          Setup wizard will be wired to APIs in Phase 2 when business modules are built.
        </p>
      </div>
    </div>
  );
}
