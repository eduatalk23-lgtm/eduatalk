"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { cn } from "@/lib/cn";
import { EditorToolbar } from "./EditorToolbar";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  /** 이미지 삽입 핸들러 — 호출 시 URL을 반환하면 에디터에 삽입 */
  onImageInsert?: () => Promise<string | null>;
  /** AI 이미지 생성 핸들러 */
  onAiImageInsert?: () => Promise<string | null>;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  className,
  editable = true,
  onImageInsert,
  onAiImageInsert,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2",
          "prose-headings:font-semibold prose-headings:text-[var(--text-heading)]",
          "prose-p:text-[var(--text-primary)] prose-p:leading-relaxed",
          "prose-strong:text-[var(--text-heading)]",
          "prose-ul:list-disc prose-ol:list-decimal",
          "prose-img:rounded-lg prose-img:max-w-full",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary-300 prose-blockquote:pl-4",
        ),
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-secondary-200 dark:border-secondary-700",
        "bg-white dark:bg-secondary-900",
        "overflow-hidden",
        className,
      )}
    >
      {editable && editor && (
        <EditorToolbar editor={editor} onImageInsert={onImageInsert} onAiImageInsert={onAiImageInsert} />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

/** 읽기 전용 HTML 렌더러 (에디터 인스턴스 없이) */
export function RichTextViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        "prose-headings:font-semibold prose-headings:text-[var(--text-heading)]",
        "prose-p:text-[var(--text-primary)] prose-p:leading-relaxed",
        "prose-img:rounded-lg prose-img:max-w-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

export type { Editor };
