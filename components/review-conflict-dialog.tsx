"use client";

import { GitCompareArrows } from "lucide-react";
import { useEffect, useRef } from "react";

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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (attempted && !ref.current?.open) ref.current?.showModal();
    if (!attempted && ref.current?.open) ref.current.close();
  }, [attempted]);

  return (
    <dialog aria-labelledby="review-conflict-title" aria-modal="true" className="confirm-dialog conflict-dialog" onCancel={(event) => { event.preventDefault(); onUseCurrent(); }} ref={ref}>
      <div className="dialog-heading"><span className="dialog-icon primary"><GitCompareArrows aria-hidden="true" /></span><div><h2 id="review-conflict-title">Review changed in another session</h2><p>Nothing was overwritten. Choose which value to continue with.</p></div></div>
      <div className="conflict-comparison">
        <section><span className="eyebrow">Currently saved</span><strong>{describe(current)}</strong><p>{current?.note || "No educator note"}</p></section>
        <section><span className="eyebrow">Your unsaved change</span><strong>{describe(attempted)}</strong><p>{attempted?.note || "No educator note"}</p></section>
      </div>
      <div className="dialog-actions"><button className="button secondary" onClick={onUseCurrent} type="button">Use saved decision</button><button className="button primary" onClick={onReapply} type="button">Apply my decision</button></div>
    </dialog>
  );
}
