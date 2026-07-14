"use client";

import { AlertTriangle, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

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
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !pending && onCancel()}>
      <AlertDialogContent
        className="max-h-[calc(100vh-2rem)] w-[calc(100%-1.25rem)] max-w-[520px] gap-0 overflow-y-auto rounded-md border border-border-strong bg-surface p-0 shadow-[0_24px_70px_rgba(13,35,47,.26)]"
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
      >
        <AlertDialogHeader className="grid grid-cols-[auto_1fr_auto] place-items-start gap-3 p-[22px] text-left max-sm:p-[18px_15px]">
          <AlertDialogMedia
            className={cn(
              "mb-0 size-[38px] rounded-full",
              tone === "danger" ? "bg-destructive-soft text-destructive" : "bg-accent text-primary"
            )}
          >
            <AlertTriangle aria-hidden="true" className="size-5" />
          </AlertDialogMedia>
          <div className="min-w-0">
            <AlertDialogTitle className="font-heading text-[21px] font-bold text-ink">{title}</AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{description}</AlertDialogDescription>
          </div>
          <AlertDialogCancel aria-label="Close dialog" disabled={pending} size="icon" variant="outline"><X aria-hidden="true" /></AlertDialogCancel>
        </AlertDialogHeader>
        {details?.length ? (
          <ul className="mx-[22px] list-disc border-y border-border py-[15px] pr-5 pl-[38px] text-[13px] leading-6 text-muted-foreground max-sm:mx-[15px]">
            {details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        ) : null}
        <AlertDialogFooter className="m-0 flex-row justify-end gap-2 rounded-none border-0 bg-transparent p-[18px_22px] max-sm:flex-col-reverse max-sm:p-[15px]">
          <AlertDialogCancel autoFocus disabled={pending} size="default" variant="secondary" className="max-sm:w-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="max-sm:w-full"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant={tone === "danger" ? "destructive" : "default"}
          >
            {pending ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
