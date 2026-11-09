"use client";

import { useId } from "react";

/** A code/output box: always LTR and monospace, even on RTL pages. */
export function CodeInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 10,
  required = false,
  maxLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="text-error-text">
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        maxLength={maxLength}
        aria-describedby={hint ? hintId : undefined}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap="off"
        className="w-full resize-y rounded-xl border border-border bg-code-bg p-3 text-left font-mono text-[13px] leading-relaxed outline-none placeholder:text-muted focus:border-primary"
      />
    </div>
  );
}
