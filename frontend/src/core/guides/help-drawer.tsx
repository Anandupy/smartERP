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
 * A page's guide entry point: a compact "Guide" control that opens "About
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
          variant="ghost"
          size="sm"
          aria-label={`Guide for this page: ${definition.title}`}
        >
          <CircleHelp />
          Guide
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
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              Quick start
            </p>
            <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
              {definition.steps.map((step) => (
                <li key={step.id}>{step.title}</li>
              ))}
            </ol>
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
