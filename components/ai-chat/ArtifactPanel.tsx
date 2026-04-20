"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, Save, X } from "lucide-react";
import { useArtifactStore, type Artifact } from "@/lib/stores/artifactStore";
import { useArtifactHistory } from "@/lib/hooks/useArtifactHistory";
import { cn } from "@/lib/cn";
import { ScoresCard } from "./ScoresCard";
import { ArtifactVersionTabs } from "./ArtifactVersionTabs";
import type { GetScoresOutput } from "@/lib/mcp/tools/getScores";
import { saveArtifactEdit } from "@/lib/domains/ai-chat/actions/artifactEdit";

const TYPE_LABELS: Record<string, string> = {
  scores: "내신 성적",
  plan: "학습 플랜",
  analysis: "생기부 분석",
  blueprint: "설계 블루프린트",
  generic: "아티팩트",
};

/**
 * Phase B-5: 반응형 아티팩트 레이아웃
 * - 데스크톱(md+): 우측 사이드 패널 (기존 동작 유지)
 * - 모바일(<md): 화면 하단 bottom sheet + 백드롭. Esc·백드롭 탭·닫기 버튼으로 해제.
 */
export function ArtifactPanel() {
  const { artifact, closeArtifact } = useArtifactStore();
  // Phase C-2: persistedId 가 주어지면 버전 히스토리 lazy fetch.
  // Phase C-3: 편집 저장 후 버전 목록 재조회용 reload 노출.
  const { reload: reloadHistory } = useArtifactHistory();

  // 모바일 sheet 가 열려 있을 때 바디 스크롤 잠금
  useEffect(() => {
    if (!artifact) return;
    const prev = document.body.style.overflow;
    // md+ 에서는 inline 스타일로 잠그지 않음 (미디어쿼리 기반 hidden 은 불가능하므로
    // matchMedia 로 분기). 데스크톱에서 잠금이 필요 없어 md+ 일 때 건너뜀.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [artifact]);

  // Esc 로 닫기 (모바일·데스크톱 공통)
  useEffect(() => {
    if (!artifact) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeArtifact();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [artifact, closeArtifact]);

  return (
    <>
      <aside
        className="hidden h-dvh w-[360px] flex-col border-l border-zinc-200 bg-zinc-50 md:flex lg:w-[480px] dark:border-zinc-800 dark:bg-zinc-950"
        aria-label="아티팩트 패널"
      >
        {!artifact ? (
          <EmptyPlaceholder />
        ) : (
          <ArtifactBody
            artifact={artifact}
            onClose={closeArtifact}
            reloadHistory={reloadHistory}
          />
        )}
      </aside>

      {artifact && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`아티팩트: ${artifact.title}`}
        >
          <button
            type="button"
            onClick={closeArtifact}
            aria-label="백드롭 — 닫기"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div
            className={cn(
              "relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-zinc-50 shadow-2xl",
              "dark:bg-zinc-950",
              "animate-in slide-in-from-bottom",
            )}
          >
            <div
              className="flex justify-center py-2"
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>
            <ArtifactBody
              artifact={artifact}
              onClose={closeArtifact}
              reloadHistory={reloadHistory}
              mobileSheet
            />
          </div>
        </div>
      )}
    </>
  );
}

function EmptyPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
        열린 아티팩트가 없습니다
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        대화 중 성적·플랜·분석 등을 펼치면 여기에 표시됩니다.
      </p>
    </div>
  );
}

function ArtifactBody({
  artifact,
  onClose,
  reloadHistory,
  mobileSheet,
}: {
  artifact: Artifact;
  onClose: () => void;
  reloadHistory: () => void;
  mobileSheet?: boolean;
}) {
  const editMode = useArtifactStore((s) => s.editMode);
  const draftProps = useArtifactStore((s) => s.draftProps);
  const enterEditMode = useArtifactStore((s) => s.enterEditMode);
  const updateDraft = useArtifactStore((s) => s.updateDraft);
  const discardDraft = useArtifactStore((s) => s.discardDraft);
  const commitDraft = useArtifactStore((s) => s.commitDraft);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const persistedId = artifact.persistedId ?? null;
  const canEdit = artifact.type === "scores" && persistedId != null;
  const displayProps = editMode ? draftProps : artifact.props;

  const handleSave = () => {
    if (!persistedId) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await saveArtifactEdit({
        artifactId: persistedId,
        props: draftProps,
      });
      if (result.ok) {
        commitDraft(result.versionNo);
        reloadHistory();
      } else {
        setSaveError(result.message ?? result.reason);
      }
    });
  };

  return (
    <>
      <header
        className={cn(
          "flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800",
          mobileSheet
            ? "px-4 py-3"
            : "bg-white px-4 py-3 dark:bg-zinc-900",
        )}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {TYPE_LABELS[artifact.type] ?? artifact.type}
          </span>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {artifact.title}
          </h2>
          {artifact.subtitle && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {artifact.subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!editMode && canEdit && (
            <button
              type="button"
              onClick={enterEditMode}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="아티팩트 편집"
            >
              <Pencil size={12} />
              편집
            </button>
          )}
          {editMode && (
            <>
              <button
                type="button"
                onClick={discardDraft}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="편집 취소"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                aria-label="편집 저장"
              >
                <Save size={12} />
                {isPending ? "저장 중…" : "저장"}
              </button>
            </>
          )}
          {!editMode && artifact.originPath && (
            <Link
              href={artifact.originPath}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="원본 GUI 화면으로 이동"
            >
              <ExternalLink size={12} />
              원본 보기
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="아티팩트 닫기"
          >
            <X size={14} />
          </button>
        </div>
      </header>
      {!editMode && <ArtifactVersionTabs />}
      {editMode && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          편집 중 — 저장 시 새 버전(v{(artifact.versionNo ?? 0) + 1})이 생성됩니다. 원본 성적 DB 는 변경되지 않습니다.
        </div>
      )}
      {saveError && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          저장 실패: {saveError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        {artifact.type === "scores" && (
          <ScoresCard
            output={displayProps as GetScoresOutput}
            editable={editMode}
            onChange={editMode ? (next) => updateDraft(next) : undefined}
          />
        )}
        {artifact.type === "generic" && (
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {JSON.stringify(displayProps, null, 2)}
          </pre>
        )}
        {artifact.type !== "scores" && artifact.type !== "generic" && (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {TYPE_LABELS[artifact.type]} 렌더러가 아직 준비되지 않았습니다.
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              추후 Wave에서 연결됩니다.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
