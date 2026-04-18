"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Square, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { ComposerAttachments } from "@/components/ai-chat/ComposerAttachments";
import {
  SlashMenu,
  type SlashCommand,
  filterSlashCommands,
  getSlashCommandsForRole,
} from "@/components/ai-chat/SlashMenu";
import { MentionMenu } from "@/components/ai-chat/MentionMenu";
import {
  ACCEPT_ATTRIBUTE,
  rejectionMessage,
  validateAttachments,
} from "@/lib/domains/ai-chat/attachments";
import {
  lookupMentionCandidates,
  type MentionCandidate,
} from "@/lib/domains/ai-chat/actions/mentions";
import { addTagsToConversation } from "@/lib/domains/ai-chat/actions/tags";
import { extractTagsFromText } from "@/lib/domains/ai-chat/tag-utils";
import type { ChatShellRole } from "@/components/ai-chat/ChatShell";

export type ComposerFilePart = {
  type: "file";
  mediaType: string;
  filename: string;
  url: string;
};

type Props = {
  role: ChatShellRole;
  conversationId: string;
  isBusy: boolean;
  onSend: (payload: { text: string; fileParts?: ComposerFilePart[] }) => void;
  onStop: () => void;
  onSlashCommand: (cmd: SlashCommand) => void;
};

export function ChatComposer({
  role,
  conversationId,
  isBusy,
  onSend,
  onStop,
  onSlashCommand,
}: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>(
    [],
  );
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionAllowed, setMentionAllowed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

  const slashActive =
    input.startsWith("/") && !input.includes(" ") && !input.includes("\n");
  const slashQuery = slashActive ? input.slice(1) : "";
  const slashCommands = slashActive
    ? filterSlashCommands(getSlashCommandsForRole(role), slashQuery)
    : [];
  const slashMenuOpen = slashActive;

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  const lastAtIndex = input.lastIndexOf("@");
  const mentionActive =
    mentionAllowed &&
    lastAtIndex !== -1 &&
    /^@[^\s]{0,20}$/.test(input.slice(lastAtIndex)) &&
    !slashActive;
  const mentionQuery = mentionActive ? input.slice(lastAtIndex + 1) : "";

  useEffect(() => {
    if (!mentionActive) {
      setMentionCandidates([]);
      setMentionIndex(0);
      return;
    }
    setMentionLoading(true);
    const handle = setTimeout(async () => {
      const res = await lookupMentionCandidates(mentionQuery);
      if (res.ok) {
        setMentionCandidates(res.candidates);
        setMentionIndex(0);
      } else if (res.reason === "forbidden") {
        setMentionAllowed(false);
        setMentionCandidates([]);
      } else {
        setMentionCandidates([]);
      }
      setMentionLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [mentionActive, mentionQuery]);

  const mentionMenuOpen = mentionActive;

  const addFiles = (incoming: File[]) => {
    const { accepted, rejected } = validateAttachments(attachments, incoming);
    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }
    if (rejected.length > 0) {
      setAttachmentError(rejectionMessage(rejected[0].reason));
    } else if (accepted.length > 0) {
      setAttachmentError(null);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const selectMention = (c: MentionCandidate) => {
    if (lastAtIndex === -1) return;
    const before = input.slice(0, lastAtIndex);
    setInput(`${before}@${c.name} `);
    setMentionCandidates([]);
  };

  const selectSlashCommand = (cmd: SlashCommand) => {
    setInput("");
    onSlashCommand(cmd);
  };

  const submit = () => {
    const text = input.trim();
    const hasFiles = attachments.length > 0;
    if (isBusy) return;
    if (!text && !hasFiles) return;

    const tags = extractTagsFromText(text);
    if (tags.length > 0) {
      void addTagsToConversation(conversationId, tags).then((res) => {
        if (res.ok) router.refresh();
      });
    }

    if (hasFiles) {
      const pendingFiles = attachments;
      const pendingText = text;
      setInput("");
      setAttachments([]);
      setAttachmentError(null);
      Promise.all(
        pendingFiles.map(async (f) => ({
          type: "file" as const,
          mediaType: f.type,
          filename: f.name,
          url: await fileToDataUrl(f),
        })),
      )
        .then((fileParts) => {
          onSend({ text: pendingText || "", fileParts });
        })
        .catch((err) => {
          setInput(pendingText);
          setAttachments(pendingFiles);
          setAttachmentError(
            err instanceof Error
              ? `첨부 변환 실패: ${err.message}`
              : "첨부 변환 실패",
          );
        });
    } else {
      onSend({ text });
      setInput("");
      setAttachmentError(null);
    }
  };

  return (
    <form
      className={cn(
        "relative border-t border-zinc-200 bg-white px-4 py-3 md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950",
        isDragging && "ring-2 ring-inset ring-zinc-900 dark:ring-zinc-100",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
          addFiles(Array.from(e.dataTransfer.files));
        }
        setIsDragging(false);
      }}
      aria-label="메시지 입력"
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl bg-zinc-50/90 text-sm font-medium text-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200">
          이미지 파일을 여기에 드롭
        </div>
      )}
      {slashMenuOpen && (
        <div className="mx-auto w-full max-w-3xl pb-2">
          <SlashMenu
            commands={slashCommands}
            activeIndex={slashIndex}
            onHover={setSlashIndex}
            onSelect={selectSlashCommand}
          />
        </div>
      )}
      {mentionMenuOpen && !slashMenuOpen && (
        <div className="mx-auto w-full max-w-3xl pb-2">
          <MentionMenu
            candidates={mentionCandidates}
            activeIndex={mentionIndex}
            loading={mentionLoading}
            onHover={setMentionIndex}
            onSelect={selectMention}
          />
        </div>
      )}
      <ComposerAttachments files={attachments} onRemove={removeAttachment} />
      {attachmentError && (
        <p
          role="alert"
          className="mx-auto max-w-3xl pb-1 text-[11px] text-red-600 dark:text-red-400"
        >
          {attachmentError}
        </p>
      )}
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-600">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(Array.from(e.target.files));
              e.target.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="이미지 첨부"
          title="이미지 첨부 (최대 5개, 각 10MB)"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const items = e.clipboardData?.files;
            if (items && items.length > 0) {
              e.preventDefault();
              addFiles(Array.from(items));
            }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (slashMenuOpen && slashCommands.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex((i) => (i + 1) % slashCommands.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex(
                  (i) =>
                    (i - 1 + slashCommands.length) % slashCommands.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const cmd = slashCommands[slashIndex];
                if (cmd) selectSlashCommand(cmd);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setInput("");
                return;
              }
            }
            if (mentionMenuOpen && mentionCandidates.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex(
                  (i) =>
                    (i - 1 + mentionCandidates.length) %
                    mentionCandidates.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const c = mentionCandidates[mentionIndex];
                if (c) selectMention(c);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionCandidates([]);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="에듀엣톡에게 말해보세요. Shift+Enter로 줄바꿈"
          rows={1}
          aria-label="메시지"
          className="flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            aria-label="생성 중지"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() && attachments.length === 0}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
            aria-label="보내기"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-400 dark:text-zinc-500">
        로컬 Gemma 4 · <kbd className="font-sans">/</kbd> 로 빠른 커맨드 ·
        응답은 참고용이며 중요한 결정 전 확인하세요.
      </p>
    </form>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
