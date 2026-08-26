"use client";

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
 * A page's guide entry point: a `?` icon that opens "About this page" and a
 * "Start guided tour" action. Drop into a screen's `PageHeader actions` —
 * nothing renders if the guide is unavailable to the current user (no
 * registered definition, or its `requirement` fails).
 */
export function GuideHelpTrigger({ guideId }: GuideHelpTriggerProps) {
  const guide = useGuide(guideId);
  const definition = getGuide(guideId);

  if (!definition || !guide.isAvailable) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Help for this page">
          <CircleHelp />
        </Button>
      </SheetTrigger>
      <SheetContent>
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
          <Button onClick={() => guide.startGuide()} disabled={guide.isActive}>
            {guide.hasSeen ? "Restart guided tour" : "Start guided tour"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
