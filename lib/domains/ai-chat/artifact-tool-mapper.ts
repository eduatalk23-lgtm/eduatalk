/**
 * Phase C-2: Tool 결과 → Artifact 매핑.
 *
 * 서버(`saveChatTurn` onFinish) 와 클라이언트(`ChatShell.MessageRow` auto-open)
 * 양쪽에서 동일 규칙을 쓸 수 있도록 순수 함수로 분리.
 *
 * 현재 지원: `getScores`, `analyzeRecord` (C-3 S3 2단계).
 */

import type { UIMessage } from "ai";
import type { GetScoresOutput } from "@/lib/mcp/tools/getScores";
import type { DesignStudentPlanOutput } from "@/lib/mcp/tools/designStudentPlan";
import type { GetBlueprintOutput } from "@/lib/mcp/tools/getBlueprint";
import type { AnalyzeRecordOutput } from "./actions/record-analysis";
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
  if (toolName === "analyzeRecord") {
    return mapAnalyzeRecord(p.output);
  }
  if (toolName === "designStudentPlan") {
    return mapDesignStudentPlan(p.output);
  }
  if (toolName === "getBlueprint") {
    return mapGetBlueprint(p.output);
  }

  return null;
}

function mapGetBlueprint(output: unknown): ArtifactCandidate | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<GetBlueprintOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<GetBlueprintOutput, { ok: true }>;
  if (!ok.mainExplorationId) return null;

  const studentLabel = ok.studentName ?? "학생";
  const sliceLabel =
    ok.scope === "track" && ok.trackLabel
      ? `${ok.trackLabel} 트랙`
      : ok.scope === "overall"
        ? "전체"
        : `${ok.grade}학년`;
  const directionLabel = ok.direction === "analysis" ? "분석" : "설계";
  const subtitleParts = [sliceLabel, directionLabel, `v${ok.version}`];

  return {
    type: "blueprint",
    title: `${studentLabel} Blueprint — ${ok.themeLabel}`,
    subtitle: subtitleParts.join(" · "),
    originPath: `/admin/students/${ok.studentId}`,
    // subjectKey: slice 단위 stable — scope/track/direction 재호출 시 동일 artifact 로
    // history 누적. mainExplorationId 는 props 에 있어 HITL writeback 이 타겟 식별 가능.
    subjectKey: [
      ok.studentId,
      ok.scope,
      ok.trackLabel ?? "",
      ok.direction,
    ].join("::"),
    props: ok,
  };
}

function mapDesignStudentPlan(output: unknown): ArtifactCandidate | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<DesignStudentPlanOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<DesignStudentPlanOutput, { ok: true }>;
  if (!ok.studentId || !ok.summary) return null;

  const studentLabel = ok.studentName ?? "학생";
  const subtitleParts: string[] = [];
  if (typeof ok.summary.adequacyScore === "number") {
    subtitleParts.push(`적합도 ${ok.summary.adequacyScore}`);
  }
  if (ok.summary.conflicts.length > 0) {
    subtitleParts.push(`충돌 ${ok.summary.conflicts.length}건`);
  }
  if (ok.summary.recommendedCourses.length > 0) {
    subtitleParts.push(`추천 ${ok.summary.recommendedCourses.length}과목`);
  }

  return {
    type: "plan",
    title: `${studentLabel} 수강 계획`,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : ok.summary.headline,
    originPath: `/admin/students/${ok.studentId}`,
    // subjectKey=studentId. 같은 학생 재설계는 마지막만.
    subjectKey: ok.studentId,
    props: ok,
  };
}

function mapAnalyzeRecord(output: unknown): ArtifactCandidate | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<AnalyzeRecordOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<AnalyzeRecordOutput, { ok: true }>;

  // 진단 요약(summary) 이 없는 단계(no_analysis 등) 도 artifact 로 노출 — 진행 상태 카드.
  // 단 학생 식별 가능해야 함.
  if (!ok.studentId) return null;

  const studentLabel = ok.studentName ?? "학생";
  const statusLabel: Record<typeof ok.status, string> = {
    no_analysis: "분석 전",
    running: "분석 진행 중",
    partial: "부분 완료",
    completed: "분석 완료",
  };
  const subtitleParts: string[] = [statusLabel[ok.status]];
  if (ok.summary) {
    subtitleParts.push(`${ok.summary.schoolYear}학년도`);
    subtitleParts.push(ok.summary.overallGrade);
  } else if (ok.progress.completedGrades.length > 0) {
    subtitleParts.push(`완료 ${ok.progress.completedGrades.join("·")}학년`);
  }

  return {
    type: "analysis",
    title: `${studentLabel} 생기부 분석`,
    subtitle: subtitleParts.join(" · "),
    originPath: ok.detailPath ?? null,
    // subjectKey = studentId. 같은 학생 재분석은 동일 artifact 버전으로 누적.
    subjectKey: ok.studentId,
    props: ok,
  };
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
