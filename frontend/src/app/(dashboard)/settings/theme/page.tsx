import type { Metadata } from 'next';
import { Palette, Upload, Eye } from 'lucide-react';
import { PageHeader } from '@/ui/v1/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Theme Studio' };

export default function ThemeStudioPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Theme Studio"
        description="Customize your organization's visual identity"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Theme Studio' }]}
        actions={
          <>
            <Button size="sm" variant="outline">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button size="sm">
              <Palette className="mr-1.5 h-3.5 w-3.5" />
              Publish
            </Button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-border bg-background p-5 space-y-6">
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Brand Assets</h3>
            <div className="space-y-2">
              {['Logo', 'Emblem'].map((label) => (
                <div key={label} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface p-3 text-center hover:border-border-strong">
                  <Upload className="h-4 w-4 text-text-muted" />
                  <span className="text-[11px] text-text-muted">Upload {label}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Colors</h3>
            <div className="space-y-2">
              {[
                { label: 'Primary', value: '#0A0A0A' },
                { label: 'Secondary', value: '#4B41E1' },
                { label: 'Accent', value: '#4B41E1' },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-[12px] text-text-secondary">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border border-border" style={{ backgroundColor: c.value }} />
                    <span className="font-code text-[11px] text-text-muted">{c.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Density</h3>
            <div className="flex gap-1.5">
              {['Dense', 'Compact', 'Comfortable'].map((mode, i) => (
                <button
                  key={mode}
                  className={`flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors ${
                    i === 0
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-muted hover:bg-surface-2'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-surface-2 p-6">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Live Preview</p>
          <div className="overflow-hidden rounded-xl border border-border bg-background shadow-md">
            <div className="flex h-56">
              <div className="w-36 border-r border-border bg-background p-3 space-y-1">
                <div className="flex items-center gap-2 rounded-md bg-primary px-2 py-1.5">
                  <div className="h-2 w-2 rounded bg-primary-foreground/40" />
                  <div className="h-1.5 w-14 rounded bg-primary-foreground/40" />
                </div>
                {[0,1,2].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="h-2 w-2 rounded bg-border-strong" />
                    <div className="h-1.5 w-10 rounded bg-border" />
                  </div>
                ))}
              </div>
              <div className="flex-1 p-4 space-y-3">
                <div className="h-3 w-28 rounded bg-surface-2" />
                <div className="grid grid-cols-2 gap-2">
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="rounded-md border border-border bg-surface p-3 space-y-1.5">
                      <div className="h-2 w-14 rounded bg-surface-2" />
                      <div className="h-4 w-10 rounded bg-surface-2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
