"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import { isValidElement } from "react";
import { CodeBlock } from "./CodeBlock";

const components: Components = {
  // Fenced blocks: <pre><code class="language-x">…</code></pre> → highlighted, LTR.
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement<{ className?: string; children?: unknown }>(child)) {
      const lang = /language-(\w+)/.exec(child.props.className ?? "")?.[1] ?? "python";
      return <CodeBlock code={String(child.props.children ?? "")} language={lang} />;
    }
    return <pre dir="ltr">{children}</pre>;
  },
  // Inline code inside (possibly RTL) sentences.
  code({ children, className }) {
    return (
      <code dir="ltr" className={className}>
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        {children}
      </a>
    );
  },
  // Model output never needs images; don't load remote content.
  img() {
    return null;
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat leading-relaxed break-words">
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
