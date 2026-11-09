/**
 * Renders a plain string where `backticked` segments become LTR inline code,
 * so code inside Hebrew sentences keeps its direction.
 */
export function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code
            key={i}
            dir="ltr"
            className="rounded border border-border bg-code-bg px-1 py-px text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
