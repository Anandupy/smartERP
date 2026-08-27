"use client";

import { useEffect, useRef, useState } from "react";

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
 * A page's guide entry point: a visible Guide button that opens "About this
 * page" and a "Start guided tour" action. The drawer is deliberately closed
 * before Joyride starts so its Sheet cannot sit above the first highlighted
 * target or compete with Joyride's focus/overlay layer.
 */
export function GuideHelpTrigger({ guideId }: GuideHelpTriggerProps) {
  const guide = useGuide(guideId);
  const definition = getGuide(guideId);
  const [open, setOpen] = useState(false);
  const pendingStart = useRef(false);
  const startTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (startTimer.current !== null) {
        window.clearTimeout(startTimer.current);
      }
    };
  }, []);

  if (!definition || !guide.isAvailable) return null;

  const startTourAfterDrawerCloses = () => {
    pendingStart.current = true;
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen || !pendingStart.current) return;

    pendingStart.current = false;
    if (startTimer.current !== null) {
      window.clearTimeout(startTimer.current);
    }

    // Let the Sheet's exit animation and focus restoration finish before the
    // Joyride portal measures the first target. This prevents the drawer from
    // obscuring the spotlight or stealing focus from the guide card.
    startTimer.current = window.setTimeout(() => {
      startTimer.current = null;
      guide.startGuide();
    }, 220);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Open ${definition.title} guide`}
          className="gap-1.5"
        >
          <CircleHelp aria-hidden="true" />
          <span>Guide</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
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
          <Button onClick={startTourAfterDrawerCloses} disabled={guide.isActive}>
            {guide.hasSeen ? "Restart guided tour" : "Start guided tour"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
