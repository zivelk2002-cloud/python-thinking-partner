"use client";

import { Highlight, themes } from "prism-react-renderer";
import { useEffect, useState } from "react";

function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/** Highlighted code. Always LTR and monospace, even inside RTL pages. */
export function CodeBlock({ code, language = "python" }: { code: string; language?: string }) {
  const dark = usePrefersDark();
  return (
    <Highlight code={code.replace(/\n$/, "")} language={language} theme={dark ? themes.vsDark : themes.github}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          dir="ltr"
          className={`${className} my-2 overflow-x-auto rounded-lg border border-border p-3 text-left font-mono text-[13px] leading-relaxed`}
          style={{ ...style, background: "var(--code-bg)" }}
        >
          <code dir="ltr">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
}
