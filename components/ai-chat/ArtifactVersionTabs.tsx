"use client";

/**
 * Phase C-2: Artifact 버전 탭 — ArtifactPanel 헤더 하단 렌더.
 *
 * versions.length <= 1 이면 렌더 안 함 (단일 버전은 탭 의미 없음).
 * 선택 시 store 의 props 를 해당 버전으로 교체.
 */

import {
  useArtifactStore,
  type ArtifactVersionSummary,
} from "@/lib/stores/artifactStore";
import { cn } from "@/lib/cn";

function formatRelative(iso: string): string {
  const created = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - created) / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}일 전`;
}

export function ArtifactVersionTabs() {
  const versions = useArtifactStore((s) => s.versions);
  const artifact = useArtifactStore((s) => s.artifact);
  const switchVersion = useArtifactStore((s) => s.switchVersion);

  if (versions.length <= 1) return null;
  const activeVersionNo = artifact?.versionNo ?? versions[0]?.versionNo ?? null;

  return (
    <nav
      className="flex items-center gap-1 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900"
      role="tablist"
      aria-label="버전 히스토리"
    >
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        버전
      </span>
      {versions.map((v) => (
        <VersionPill
          key={v.id}
          version={v}
          active={v.versionNo === activeVersionNo}
          onClick={() => switchVersion(v.versionNo, v.props)}
        />
      ))}
    </nav>
  );
}

function VersionPill({
  version,
  active,
  onClick,
}: {
  version: ArtifactVersionSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={`v${version.versionNo} · ${new Date(version.createdAt).toLocaleString()}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[var(--color-primary-600)] text-white"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
      )}
    >
      <span>v{version.versionNo}</span>
      <span
        className={cn(
          "text-[10px]",
          active ? "text-white/80" : "text-zinc-400 dark:text-zinc-500",
        )}
      >
        {formatRelative(version.createdAt)}
      </span>
      {version.editedByUserId && (
        <span
          className={cn(
            "rounded px-1 text-[9px] font-semibold",
            active
              ? "bg-white/20 text-white"
              : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
          )}
          aria-label="사용자 편집 버전"
        >
          편집
        </span>
      )}
    </button>
  );
}
