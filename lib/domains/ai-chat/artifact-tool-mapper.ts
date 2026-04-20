/**
 * Phase C-2: Tool 결과 → Artifact 매핑.
 *
 * 서버(`saveChatTurn` onFinish) 와 클라이언트(`ChatShell.MessageRow` auto-open)
 * 양쪽에서 동일 규칙을 쓸 수 있도록 순수 함수로 분리.
 *
 * 현재 지원: `getScores` 만. 향후 analyzeRecordDeep 등 추가.
 */

import type { UIMessage } from "ai";
import type { GetScoresOutput } from "@/lib/mcp/tools/getScores";
import type { ArtifactType } from "./artifact-repository";

export type ArtifactCandidate = {
  type: ArtifactType;
  title: string;
  subtitle: string | null;
  originPath: string | null;
  subjectKey: string | null;
  props: unknown;
};

/**
 * 한 assistant 메시지의 parts 에서 artifact 후보 목록 추출.
 * 같은 type × subjectKey 가 여러 번 등장하면 **마지막** 하나만 반환 (중복 제거).
 */
export function extractArtifactCandidates(
  parts: UIMessage["parts"],
): ArtifactCandidate[] {
  if (!Array.isArray(parts)) return [];

  const seen = new Map<string, ArtifactCandidate>();

  for (const rawPart of parts) {
    const candidate = mapPartToCandidate(rawPart);
    if (!candidate) continue;
    const dedupKey = `${candidate.type}::${candidate.subjectKey ?? ""}`;
    seen.set(dedupKey, candidate);
  }

  return Array.from(seen.values());
}

function mapPartToCandidate(part: unknown): ArtifactCandidate | null {
  if (!part || typeof part !== "object") return null;
  const p = part as {
    type?: unknown;
    toolName?: unknown;
    output?: unknown;
    state?: unknown;
  };

  const toolName =
    typeof p.toolName === "string"
      ? p.toolName
      : typeof p.type === "string" && p.type.startsWith("tool-")
        ? p.type.slice("tool-".length)
        : null;
  if (!toolName) return null;

  // 완료된 tool output 만 대상 — pending/streaming 은 제외.
  const state = typeof p.state === "string" ? p.state : null;
  if (state && state !== "output-available" && state !== "result") {
    return null;
  }

  if (toolName === "getScores") {
    return mapGetScores(p.output);
  }

  return null;
}

function mapGetScores(output: unknown): ArtifactCandidate | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<GetScoresOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<GetScoresOutput, { ok: true }>;
  if (typeof ok.count !== "number" || ok.count === 0) return null;

  const filter = ok.filter ?? {};
  const subtitleParts = [
    filter.grade ? `${filter.grade}학년` : null,
    filter.semester ? `${filter.semester}학기` : null,
    `${ok.count}과목`,
  ].filter(Boolean);

  return {
    type: "scores",
    title: `${ok.studentName ?? "학생"} 내신 성적`,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : null,
    originPath:
      filter.grade && filter.semester
        ? `/scores/school/${filter.grade}/${filter.semester}`
        : "/scores",
    // subject_key = studentName. 같은 학생 성적 재조회는 동일 artifact 버전으로 누적.
    subjectKey: ok.studentName ?? null,
    props: ok,
  };
}
