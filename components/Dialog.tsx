"use client";

import { useEffect, useRef } from "react";

/** Thin wrapper over <dialog>: native focus trap, Esc to close, focus returns on close. */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} max-h-[calc(100dvh-2rem)] rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/50`}
    >
      <div className="p-5">{children}</div>
    </dialog>
  );
}
