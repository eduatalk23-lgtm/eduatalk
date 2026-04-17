"use client";

import { useArtifactStore } from "@/lib/stores/artifactStore";
import { ScoresCard } from "./ScoresCard";
import type { GetScoresOutput } from "@/app/api/chat/route";

const TYPE_LABELS: Record<string, string> = {
  scores: "내신 성적",
  plan: "학습 플랜",
  analysis: "생기부 분석",
  blueprint: "설계 블루프린트",
  generic: "아티팩트",
};

export function ArtifactPanel() {
  const { artifact, closeArtifact } = useArtifactStore();

  return (
    <aside
      className="hidden h-dvh w-[360px] flex-col border-l border-zinc-200 bg-zinc-50 md:flex lg:w-[480px] dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="아티팩트 패널"
    >
      {!artifact ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            열린 아티팩트가 없습니다
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            대화 중 성적·플랜·분석 등을 펼치면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
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
            <button
              type="button"
              onClick={closeArtifact}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              aria-label="아티팩트 닫기"
            >
              닫기
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {artifact.type === "scores" && (
              <ScoresCard output={artifact.props as GetScoresOutput} />
            )}
            {artifact.type === "generic" && (
              <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {JSON.stringify(artifact.props, null, 2)}
              </pre>
            )}
            {artifact.type !== "scores" && artifact.type !== "generic" && (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {TYPE_LABELS[artifact.type]} 렌더러가 아직 준비되지
                  않았습니다.
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  추후 Wave에서 연결됩니다.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
