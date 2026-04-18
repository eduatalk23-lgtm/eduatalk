"use client";

/**
 * Phase B-6: composer 첨부 미리보기 칩
 *
 * ChatShell 이 File[] 을 관리하고 이 컴포넌트는 순수 렌더.
 */

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Props = {
  files: File[];
  onRemove: (index: number) => void;
};

export function ComposerAttachments({ files, onRemove }: Props) {
  const [urls, setUrls] = useState<string[]>([]);

  // 각 File 에 대해 object URL 을 만들고 unmount/변경 시 revoke.
  useEffect(() => {
    const created = files.map((f) => URL.createObjectURL(f));
    setUrls(created);
    return () => {
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, [files]);

  const entries = useMemo(
    () =>
      files.map((f, i) => ({
        name: f.name,
        url: urls[i],
        size: f.size,
      })),
    [files, urls],
  );

  if (entries.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 pb-2">
      {entries.map((e, i) => (
        <div
          key={`${e.name}-${i}`}
          className="group relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1.5 pr-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {e.url ? (
            // 이미지 썸네일
            <div className="h-10 w-10 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.url}
                alt={e.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-md bg-zinc-100 dark:bg-zinc-800" />
          )}
          <div className="flex flex-col gap-0">
            <span className="max-w-[140px] truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {e.name}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {(e.size / 1024).toFixed(0)} KB
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`${e.name} 제거`}
            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/80 text-white hover:bg-zinc-900 dark:bg-zinc-200/90 dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
