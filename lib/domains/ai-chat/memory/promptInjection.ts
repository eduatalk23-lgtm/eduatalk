/**
 * Phase D-4 Sprint 2: `/api/chat` 전단 기억 주입.
 *
 * 요청 수신 → 마지막 user 메시지 embedding → top-K 검색 → 시스템 프롬프트
 * 조각(`[관련 과거 대화]`) 생성. handoff 프롬프트와 같은 dynamic suffix 레이어.
 *
 * 실패·빈 결과는 빈 문자열 반환 — 호출자는 그대로 concat.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import { createMemoryEmbedding } from "./embedding";
import { searchMemoriesByEmbedding } from "./repository";
import type { MemorySearchHit } from "./types";

type Client = SupabaseClient<Database>;

/** 개별 hit 본문이 프롬프트에 들어갈 때의 문자 수 상한. */
const HIT_CONTENT_CAP = 400;

/** 기본 retrieval 파라미터. Sprint 3 에서 조정 가능. */
const DEFAULT_MATCH_COUNT = 4;
const DEFAULT_SIMILARITY_THRESHOLD = 0.35;

export interface BuildMemoryPromptArgs {
  supabase: Client;
  queryText: string;
  ownerUserId: string;
  /** 학생 문맥 (없으면 owner 범위 전체에서 검색). */
  subjectStudentId?: string | null;
  /** 현재 대화 id — 포함 시 같은 대화 hit 은 컨텍스트와 중복이라 제외. */
  currentConversationId?: string | null;
  matchCount?: number;
  similarityThreshold?: number;
}

export type BuildMemoryPromptResult = {
  /** 프롬프트에 바로 붙일 블록. 비었을 경우 "". */
  section: string;
  /** 실제 사용된 hit 개수(필터 이후). 0 이면 section=="". */
  usedHits: number;
};

export async function buildMemoryPromptSection(
  args: BuildMemoryPromptArgs,
): Promise<BuildMemoryPromptResult> {
  const query = args.queryText.trim();
  if (query.length < 5) return { section: "", usedHits: 0 };

  let embedding: number[] | null;
  try {
    embedding = await createMemoryEmbedding(query);
  } catch {
    return { section: "", usedHits: 0 };
  }
  if (!embedding) return { section: "", usedHits: 0 };

  const searched = await searchMemoriesByEmbedding(args.supabase, {
    queryEmbedding: embedding,
    ownerUserId: args.ownerUserId,
    subjectStudentId: args.subjectStudentId ?? null,
    matchCount: args.matchCount ?? DEFAULT_MATCH_COUNT,
    similarityThreshold:
      args.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
  });

  if (!searched.ok || searched.hits.length === 0) {
    return { section: "", usedHits: 0 };
  }

  const filtered: MemorySearchHit[] = args.currentConversationId
    ? searched.hits.filter(
        (h) => h.conversationId !== args.currentConversationId,
      )
    : searched.hits;

  if (filtered.length === 0) return { section: "", usedHits: 0 };

  return {
    section: renderMemorySection(filtered),
    usedHits: filtered.length,
  };
}

/**
 * hits → 시스템 프롬프트 블록. 순수 함수. 테스트 용이.
 */
export function renderMemorySection(hits: MemorySearchHit[]): string {
  if (hits.length === 0) return "";
  const lines: string[] = [
    "[관련 과거 대화 — 장기 기억]",
    "아래는 같은 사용자가 이전 대화에서 남긴 관련 내용입니다. 필요할 때만 맥락으로 참고하고, 내용 자체를 직접 인용하거나 존재를 언급하지 마세요.",
  ];
  hits.forEach((hit, idx) => {
    const date = (hit.createdAt ?? "").slice(0, 10) || "unknown";
    const body = hit.content.replace(/\s+/g, " ").slice(0, HIT_CONTENT_CAP);
    lines.push(`- [${idx + 1}] (${date}) ${body}`);
  });
  return lines.join("\n");
}
