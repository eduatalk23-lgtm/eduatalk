"use client";

/**
 * Phase C-2: 대화 artifact 히스토리 훅.
 *
 * 현재 ArtifactPanel 에 열려 있는 artifact 가 DB persistedId 를 가지면, 해당
 * artifact 의 전체 버전 목록을 fetch 하여 zustand store 에 주입한다.
 * 버전 탭 UI 가 이 store 를 읽어 렌더.
 */

import { useCallback, useEffect, useState } from "react";
import { useArtifactStore, type ArtifactVersionSummary } from "@/lib/stores/artifactStore";

/**
 * Phase C-3: 편집 저장 성공 후 버전 목록을 재조회하기 위한 reload 트리거 반환.
 * ArtifactPanel 이 saveArtifactEdit 성공 후 reload() 호출.
 */
export function useArtifactHistory(): { reload: () => void } {
  const artifact = useArtifactStore((s) => s.artifact);
  const setVersions = useArtifactStore((s) => s.setVersions);

  const persistedId = artifact?.persistedId ?? null;
  const [reloadCounter, setReloadCounter] = useState(0);

  const reload = useCallback(() => setReloadCounter((n) => n + 1), []);

  useEffect(() => {
    if (!persistedId) {
      setVersions([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/ai-chat/artifacts?artifactId=${encodeURIComponent(persistedId!)}`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          ok: boolean;
          versions?: Array<{
            id: string;
            versionNo: number;
            createdAt: string;
            editedByUserId: string | null;
            props: unknown;
          }>;
        };
        if (cancelled) return;
        if (body.ok && body.versions) {
          const summaries: ArtifactVersionSummary[] = body.versions.map((v) => ({
            id: v.id,
            versionNo: v.versionNo,
            createdAt: v.createdAt,
            editedByUserId: v.editedByUserId,
            props: v.props,
          }));
          setVersions(summaries);
        }
      } catch {
        // 실패 시 조용히 — 버전 탭만 비어 있음.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [persistedId, setVersions, reloadCounter]);

  return { reload };
}
