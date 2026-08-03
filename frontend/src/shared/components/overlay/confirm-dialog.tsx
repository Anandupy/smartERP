"use client";

import { TriangleAlert, type LucideIcon } from "@/assets/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/shared/components/feedback";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, and what cannot be undone. */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm control as destructive and shows a warning glyph. */
  destructive?: boolean;
  /** Overrides the glyph shown beside the title. */
  icon?: LucideIcon;
  /** Blocks both controls and shows a spinner while the action runs. */
  isPending?: boolean;
  onConfirm: () => void;
  /** Extra content between the description and the controls. */
  children?: React.ReactNode;
}

/**
 * The single confirmation prompt for irreversible actions.
 *
 * Built on `AlertDialog`, not `Dialog`: an alert dialog is announced as
 * `alertdialog` and cannot be dismissed by clicking away — the right semantics
 * when the answer actually matters.
 *
 * The dialog does not close itself on confirm. The caller closes it once the
 * mutation settles, so the pending state stays visible while the request is in
 * flight instead of the dialog vanishing and leaving the outcome unexplained.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon,
  isPending = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const Icon = icon ?? (destructive ? TriangleAlert : undefined);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {Icon ? (
            <AlertDialogMedia
              className={
                destructive ? "bg-destructive/10 text-destructive" : ""
              }
            >
              <Icon aria-hidden="true" />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={(event) => {
              // Radix closes the dialog on action by default; the caller owns
              // that decision so the pending state can outlive the click.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? <Spinner size="sm" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
