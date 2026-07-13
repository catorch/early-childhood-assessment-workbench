"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  pending = false,
  tone = "danger",
  onCancel,
  onConfirm
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly details?: readonly string[];
  readonly confirmLabel: string;
  readonly pending?: boolean;
  readonly tone?: "danger" | "primary";
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => cancelRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby="confirmation-dialog-title"
      aria-modal="true"
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      ref={dialogRef}
    >
      <div className="dialog-heading">
        <span className={`dialog-icon ${tone}`}><AlertTriangle aria-hidden="true" /></span>
        <div><h2 id="confirmation-dialog-title">{title}</h2><p>{description}</p></div>
        <button aria-label="Close dialog" className="icon-button" disabled={pending} onClick={onCancel} type="button"><X aria-hidden="true" /></button>
      </div>
      {details?.length ? <ul className="dialog-details">{details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
      <div className="dialog-actions">
        <button className="button secondary" disabled={pending} onClick={onCancel} ref={cancelRef} type="button">Cancel</button>
        <button className={`button ${tone === "danger" ? "danger" : "primary"}`} disabled={pending} onClick={onConfirm} type="button">
          {pending ? "Working..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
