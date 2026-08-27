"use client";

import { useRef, useState } from "react";

import { CircleHelp } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { getGuide } from "./registry";
import { useGuide } from "./use-guide";

export interface GuideHelpTriggerProps {
  guideId: string;
}

/**
 * A page's guide entry point: a visible "Guide" control that opens "About
 * this page" and a "Start guided tour" action. Drop into a screen's
 * `PageHeader actions` — nothing renders if the guide is unavailable to the
 * current user (no registered definition, or its `requirement` fails).
 */
export function GuideHelpTrigger({ guideId }: GuideHelpTriggerProps) {
  const guide = useGuide(guideId);
  const definition = getGuide(guideId);
  const [open, setOpen] = useState(false);
  // Set on click, consumed (and cleared) once the sheet's own close
  // animation and focus restoration actually finish — see `onCloseAutoFocus`
  // below. Never call `startGuide()` from the click handler itself: Joyride's
  // overlay must never be mounted underneath a still-open (or still-closing)
  // Sheet, which is exactly the "drawer + tour at once" state this avoids.
  const pendingStartRef = useRef(false);

  if (!definition || !guide.isAvailable) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Guide for this page: ${definition.title}`}
          className="gap-1.5"
        >
          <CircleHelp aria-hidden="true" />
          <span>Guide</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        onCloseAutoFocus={() => {
          if (!pendingStartRef.current) return;
          pendingStartRef.current = false;
          guide.startGuide();
        }}
      >
        <SheetHeader>
          <SheetTitle>{definition.title}</SheetTitle>
          <SheetDescription>{definition.description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-foreground text-sm font-medium">
                Quick start
              </p>
              <span className="text-muted-foreground text-xs">
                {definition.steps.length} guided steps
              </span>
            </div>
            <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
              {definition.steps.map((step) => (
                <li key={step.id}>{step.title}</li>
              ))}
            </ol>
          </div>
          <div className="bg-muted/50 ring-border/60 rounded-lg p-3 ring-1">
            <p className="text-foreground text-sm font-medium">
              Want to see it in action?
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              The tour will dim the page, spotlight the exact control you need,
              and wait for you to complete each real action before moving on.
            </p>
          </div>
          <Button
            onClick={() => {
              pendingStartRef.current = true;
              setOpen(false);
            }}
            disabled={guide.isActive}
          >
            {guide.hasSeen ? "Restart guided tour" : "Start guided tour"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
