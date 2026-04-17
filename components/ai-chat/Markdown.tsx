"use client";

import { memo, useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/cn";

import "katex/dist/katex.min.css";

const SHIKI_LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  mdx: "mdx",
  rs: "rust",
  kt: "kotlin",
};

const SHIKI_SUPPORTED = new Set([
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "bash",
  "json",
  "yaml",
  "sql",
  "html",
  "css",
  "scss",
  "markdown",
  "mdx",
  "go",
  "rust",
  "java",
  "kotlin",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "swift",
  "r",
  "dart",
  "lua",
  "diff",
  "dockerfile",
  "nginx",
  "toml",
  "xml",
]);

function resolveLang(input: string | undefined): string {
  if (!input) return "text";
  const lower = input.toLowerCase();
  const aliased = SHIKI_LANG_ALIASES[lower] ?? lower;
  return SHIKI_SUPPORTED.has(aliased) ? aliased : "text";
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const resolved = resolveLang(lang);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const rendered = await codeToHtml(code, {
          lang: resolved,
          theme: "github-light",
        });
        if (!cancelled) setHtml(rendered);
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, resolved]);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white/60 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {resolved === "text" ? (lang || "plain") : resolved}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
          }}
          className="text-[11px] text-zinc-500 hover:text-zinc-800"
        >
          복사
        </button>
      </div>
      {html ? (
        <div
          className="shiki-wrapper overflow-x-auto text-[13px] leading-6 [&_pre]:bg-transparent! [&_pre]:p-3 [&_pre]:m-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="m-0 overflow-x-auto p-3 text-[13px] leading-6 text-zinc-800">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="my-2 text-[15px] leading-7 text-zinc-900 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-xl font-semibold text-zinc-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-lg font-semibold text-zinc-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-base font-semibold text-zinc-900 first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 text-[15px] leading-7 text-zinc-900 marker:text-zinc-400">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 text-[15px] leading-7 text-zinc-900 marker:text-zinc-400">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-zinc-300 pl-3 text-zinc-700">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-zinc-200" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-100 px-3 py-2 text-zinc-800">
      {children}
    </td>
  ),
  code: ({ className, children, ...props }) => {
    const raw = String(children ?? "");
    const match = /language-([\w-]+)/.exec(className ?? "");
    if (!match) {
      return (
        <code
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-800"
          {...props}
        >
          {children}
        </code>
      );
    }
    return <CodeBlock code={raw.replace(/\n$/, "")} lang={match[1]} />;
  },
  pre: ({ children }) => <>{children}</>,
};

type Props = {
  text: string;
  variant?: "assistant" | "user";
  className?: string;
};

export const Markdown = memo(function Markdown({
  text,
  variant = "assistant",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "markdown-root",
        variant === "user" ? "text-[15px] leading-6" : "text-[15px] leading-7",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
