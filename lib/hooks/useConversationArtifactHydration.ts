"use client";

/**
 * Phase C-2: 대화 artifact 히드레이션.
 *
 * ChatShell 이 마운트·응답 완료 시점에 해당 대화의 모든 artifact 를 fetch 하고,
 * 현재 열려 있는 artifact(client-generated id) 에 DB persistedId 를 주입한다.
 * 주입되면 useArtifactHistory 가 버전 탭을 자동 로드.
 */

import { useCallback } from "react";
import { useArtifactStore } from "@/lib/stores/artifactStore";

type ArtifactApiRow = {
  id: string;
  type: string;
  subjectKey: string | null;
  latestVersion: number;
};

/**
 * @returns 수동 재호출 가능한 hydrate 함수.
 *   ChatShell 에서 `useChat({ onFinish: hydrate })` 로 연결.
 */
export function useConversationArtifactHydration(
  conversationId: string,
): () => Promise<void> {
  return useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai-chat/artifacts?conversationId=${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok: boolean;
        artifacts?: ArtifactApiRow[];
      };
      if (!body.ok || !body.artifacts) return;

      const { artifact, openArtifact } = useArtifactStore.getState();
      if (!artifact || artifact.persistedId) return;

      // client-side 임시 id 규약: `<type>:<toolCallId>`. subjectKey 매칭으로 탐색.
      // props 에서 type 의존적으로 식별자 추출.
      const subjectKey = extractSubjectKey(artifact.type, artifact.props);

      const match = body.artifacts.find(
        (a) => a.type === artifact.type && a.subjectKey === subjectKey,
      );
      if (!match) return;

      openArtifact({
        ...artifact,
        persistedId: match.id,
        versionNo: match.latestVersion,
      });
    } catch {
      // 네트워크 실패 시 조용히 — 버전 탭만 나타나지 않음.
    }
  }, [conversationId]);
}

function extractSubjectKey(type: string, props: unknown): string | null {
  if (!props || typeof props !== "object") return null;
  const p = props as Record<string, unknown>;
  if (type === "scores") {
    return typeof p.studentName === "string" ? p.studentName : null;
  }
  return null;
}
