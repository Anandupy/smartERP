"use client";

import { ImageIcon, Sparkles, Upload } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appConfig } from "@/config";
import { cn } from "@/lib/utils";
import {
  BackendPendingBadge,
  BackendPendingNote,
  Banner,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

interface AssetSlotProps {
  title: string;
  description: string;
  /** Aspect of the drop target, so each slot previews its real proportions. */
  aspect: string;
}

/**
 * One brand asset: what it is, where it appears, and where it would be
 * uploaded. Inert — there is no endpoint behind it.
 */
function AssetSlot({ title, description, aspect }: AssetSlotProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div
        aria-disabled="true"
        className={cn(
          "border-border text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center opacity-70",
          aspect,
        )}
      >
        <ImageIcon aria-hidden="true" className="size-6" />
        <p className="text-xs">No asset uploaded</p>
      </div>
      <Button type="button" variant="outline" size="sm" disabled>
        <Upload />
        Upload
      </Button>
    </div>
  );
}

/**
 * Branding & Identity.
 *
 * **Backend Pending in full.** The System Settings contract covers product
 * name, code, version, environment, maintenance and support — it has no logo,
 * favicon, icon or colour field, and no upload endpoint is documented anywhere
 * in the module's API reference or Postman collection.
 *
 * So the screen ships as layout: the asset slots the design calls for, and a
 * live preview showing that a future brand would be applied through the
 * platform's semantic tokens rather than hard-coded colours. Every control is
 * disabled. Nothing here posts, and nothing here invents a field name that the
 * backend would have to match later.
 */
export function BrandingScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding &amp; Identity"
        description="Visual assets shown across the institution's workspace."
        badge={<BackendPendingBadge />}
      />

      <Banner
        tone="info"
        icon={Sparkles}
        title="No backend contract yet"
        description="The System Settings API documents no branding fields and no asset upload endpoint. This screen is the layout only — nothing can be saved."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Brand assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <AssetSlot
                title="Organization logo (horizontal)"
                description="Used in the sidebar and on official reports."
                aspect="min-h-28"
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <AssetSlot
                  title="Favicon"
                  description="Browser tab icon."
                  aspect="min-h-24"
                />
                <AssetSlot
                  title="Collapsed icon"
                  description="Square mark for the collapsed sidebar rail."
                  aspect="min-h-24"
                />
              </div>
              <BackendPendingNote>
                uploads need a documented endpoint, accepted MIME types, size
                limits and the field names the settings record would store them
                under.
              </BackendPendingNote>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Palette</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <p className="text-muted-foreground text-sm">
                {appConfig.name} styles every surface from semantic design
                tokens, so a workspace palette would restyle the whole
                application without any screen changing. The token interfaces
                exist; the values a backend would supply do not.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  ["Primary", "bg-primary"],
                  ["Secondary", "bg-secondary"],
                  ["Accent", "bg-accent"],
                  ["Destructive", "bg-destructive"],
                ].map(([label, swatch]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "border-border size-6 rounded-md border",
                        swatch,
                      )}
                    />
                    <span className="text-muted-foreground text-xs">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <BackendPendingNote>
                per-workspace palettes need a theme contract from the backend.
              </BackendPendingNote>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle>Live preview</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="sign-in">
              <TabsList className="w-full">
                <TabsTrigger value="sign-in" className="flex-1">
                  Sign-in
                </TabsTrigger>
                <TabsTrigger value="navigation" className="flex-1">
                  Navigation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sign-in" className="pt-4">
                <div className="border-border space-y-3 rounded-xl border p-4">
                  <div className="bg-muted mx-auto h-8 w-32 rounded-md" />
                  <div className="bg-muted h-8 rounded-md" />
                  <div className="bg-muted h-8 rounded-md" />
                  <div className="bg-primary h-9 rounded-md" />
                </div>
              </TabsContent>

              <TabsContent value="navigation" className="pt-4">
                <div className="border-border flex gap-3 rounded-xl border p-4">
                  <div className="w-16 space-y-2">
                    <div className="bg-primary h-6 rounded-md" />
                    <div className="bg-muted h-4 rounded-md" />
                    <div className="bg-muted h-4 rounded-md" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-4 rounded-md" />
                    <div className="bg-muted h-16 rounded-md" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-muted-foreground mt-3 text-xs">
              Rendered from the current theme tokens.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
