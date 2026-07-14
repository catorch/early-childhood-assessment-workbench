"use client";

import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import type { PrimaryCredit, SavedReviewDecision } from "@/lib/help-review/domain";
import { creditPresentation } from "@/lib/help-review/presentation";

interface DecisionIntent {
  readonly finalCredit: PrimaryCredit | null;
  readonly dismissed: boolean;
  readonly note: string | null;
}

function describe(value: DecisionIntent | SavedReviewDecision | null): string {
  if (!value) return "No saved decision";
  if (value.dismissed) return "Dismissed";
  return value.finalCredit ? creditPresentation[value.finalCredit].label : "No credit";
}

export function ReviewConflictDialog({
  current,
  attempted,
  onUseCurrent,
  onReapply
}: {
  readonly current: SavedReviewDecision | null;
  readonly attempted: DecisionIntent | null;
  readonly onUseCurrent: () => void;
  readonly onReapply: () => void;
}) {
  return (
    <AlertDialog open={Boolean(attempted)} onOpenChange={(open) => !open && onUseCurrent()}>
      <AlertDialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-1.25rem)] max-w-[560px] gap-0 overflow-y-auto rounded-md border border-border-strong bg-surface p-0 shadow-[0_24px_70px_rgba(13,35,47,.26)]">
        <AlertDialogHeader className="grid grid-cols-[auto_1fr] place-items-start gap-3 p-[22px] text-left max-sm:p-[18px_15px]">
          <AlertDialogMedia className="mb-0 size-[38px] rounded-full bg-warning-soft text-warning">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </AlertDialogMedia>
          <div>
            <AlertDialogTitle className="font-heading text-[21px] font-bold text-ink">Review changed in another session</AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
              Your save was paused because a newer decision is already stored. Nothing was overwritten.
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <div className="mx-[22px] grid grid-cols-2 gap-px border border-border bg-border max-sm:mx-[15px] max-sm:grid-cols-1">
          <section className="min-w-0 bg-surface p-4">
            <span className="text-[11px] font-extrabold uppercase text-primary-strong">Your unsaved change</span>
            <strong className="mt-2 block">{describe(attempted)}</strong>
            <p className="mt-1.5 min-h-8 [overflow-wrap:anywhere] text-xs text-muted-foreground">{attempted?.note || "No educator note"}</p>
          </section>
          <section className="min-w-0 bg-surface p-4">
            <span className="text-[11px] font-extrabold uppercase text-primary-strong">Latest saved decision</span>
            <strong className="mt-2 block">{describe(current)}</strong>
            <p className="mt-1.5 min-h-8 [overflow-wrap:anywhere] text-xs text-muted-foreground">{current?.note || "No educator note"}</p>
          </section>
        </div>
        <AlertDialogFooter className="m-0 flex-row justify-end gap-2 rounded-none border-0 bg-transparent p-[18px_22px] max-sm:flex-col-reverse max-sm:p-[15px]">
          <AlertDialogCancel className="max-sm:w-full" onClick={onUseCurrent} variant="secondary">Use latest decision</AlertDialogCancel>
          <AlertDialogAction
            className="max-sm:w-full"
            onClick={(event) => {
              event.preventDefault();
              onReapply();
            }}
          >
            Reapply my decision
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
