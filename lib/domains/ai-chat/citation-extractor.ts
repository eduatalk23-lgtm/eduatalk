/**
 * Phase C-4 (2026-04-21): Assistant 메시지 parts → Citation 후보 추출.
 *
 * artifact-tool-mapper 와 유사하지만 목적이 다름:
 *  · mapper 는 artifact row 를 **생성·업서트** 하기 위해 props 전체를 들고 있음.
 *  · extractor 는 UI 하단에 "근거" 배지로 노출하기 위한 가벼운 라벨·식별자만 뽑는다.
 *
 * 클릭 시 artifactId 로 ArtifactPanel 을 열어주는 핸들러는 UI 레이어에서 resolve
 * (subjectKey + type → artifactId) — citation 자체에는 artifactId 를 포함하지 않는다.
 */

import type { UIMessage } from "ai";
import type { GetScoresOutput } from "@/lib/mcp/tools/getScores";
import type { DesignStudentPlanOutput } from "@/lib/mcp/tools/designStudentPlan";
import type { GetBlueprintOutput } from "@/lib/mcp/tools/getBlueprint";
import type { AnalyzeRecordOutput } from "./actions/record-analysis";
import type { ArtifactType } from "./artifact-repository";

export type MessageCitation = {
  /** 원본 tool 이름. 예: "getScores", "analyzeRecord", "designStudentPlan" */
  tool: string;
  /** 연결된 artifact type (ArtifactPanel 에서 조회·열림 시 필터 키) */
  type: ArtifactType;
  /** artifact subjectKey 와 동일 — UI 가 (type, subjectKey) → artifactId resolve */
  subjectKey: string;
  /** 배지 1차 라벨. 예: "김세린 · 2학년 성적" */
  label: string;
  /** 선택 보조 설명. 예: "5과목 · A-" */
  detail?: string | null;
  /** artifact 미존재 대안 이동 경로 (예: /scores/school/2/1) */
  originPath?: string | null;
};

/**
 * 한 assistant 메시지에서 근거 목록 추출. 같은 (type, subjectKey) 는 dedup 후 마지막 우선.
 */
export function extractCitations(parts: UIMessage["parts"]): MessageCitation[] {
  if (!Array.isArray(parts)) return [];

  const seen = new Map<string, MessageCitation>();
  for (const rawPart of parts) {
    const citation = mapPartToCitation(rawPart);
    if (!citation) continue;
    const key = `${citation.type}::${citation.subjectKey}`;
    seen.set(key, citation);
  }
  return Array.from(seen.values());
}

function mapPartToCitation(part: unknown): MessageCitation | null {
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

  const state = typeof p.state === "string" ? p.state : null;
  if (state && state !== "output-available" && state !== "result") return null;

  if (toolName === "getScores") return citeGetScores(p.output);
  if (toolName === "analyzeRecord") return citeAnalyzeRecord(p.output);
  if (toolName === "designStudentPlan") return citeDesignStudentPlan(p.output);
  if (toolName === "getBlueprint") return citeGetBlueprint(p.output);
  return null;
}

function citeGetBlueprint(output: unknown): MessageCitation | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<GetBlueprintOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<GetBlueprintOutput, { ok: true }>;
  if (!ok.mainExplorationId || !ok.studentId) return null;

  const sliceLabel =
    ok.scope === "track" && ok.trackLabel
      ? `${ok.trackLabel} 트랙`
      : ok.scope === "overall"
        ? "전체"
        : `${ok.grade}학년`;
  const directionLabel = ok.direction === "analysis" ? "분석" : "설계";

  return {
    tool: "getBlueprint",
    type: "blueprint",
    // mapper 와 동일 dedup 규약.
    subjectKey: [
      ok.studentId,
      ok.scope,
      ok.trackLabel ?? "",
      ok.direction,
    ].join("::"),
    label: `${ok.studentName ?? "학생"} Blueprint`,
    detail: `${sliceLabel} · ${directionLabel} · v${ok.version}`,
    originPath: `/admin/students/${ok.studentId}`,
  };
}

function citeGetScores(output: unknown): MessageCitation | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<GetScoresOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<GetScoresOutput, { ok: true }>;
  if (typeof ok.count !== "number" || ok.count === 0) return null;
  const subjectKey = ok.studentName ?? "";
  if (!subjectKey) return null;

  const filterParts = [
    ok.filter?.grade ? `${ok.filter.grade}학년` : null,
    ok.filter?.semester ? `${ok.filter.semester}학기` : null,
  ].filter(Boolean);
  const label =
    filterParts.length > 0
      ? `${subjectKey} · ${filterParts.join(" ")} 내신`
      : `${subjectKey} 내신`;

  return {
    tool: "getScores",
    type: "scores",
    subjectKey,
    label,
    detail: `${ok.count}과목`,
    originPath:
      ok.filter?.grade && ok.filter?.semester
        ? `/scores/school/${ok.filter.grade}/${ok.filter.semester}`
        : "/scores",
  };
}

function citeAnalyzeRecord(output: unknown): MessageCitation | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<AnalyzeRecordOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<AnalyzeRecordOutput, { ok: true }>;
  if (!ok.studentId) return null;

  const detailParts: string[] = [];
  if (ok.summary?.overallGrade) detailParts.push(ok.summary.overallGrade);
  if (ok.summary?.schoolYear) detailParts.push(`${ok.summary.schoolYear}학년도`);
  else if (ok.status === "completed") detailParts.push("분석 완료");
  else if (ok.status === "running") detailParts.push("분석 진행 중");

  return {
    tool: "analyzeRecord",
    type: "analysis",
    subjectKey: ok.studentId,
    label: `${ok.studentName ?? "학생"} 생기부 분석`,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    originPath: ok.detailPath ?? null,
  };
}

function citeDesignStudentPlan(output: unknown): MessageCitation | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Partial<DesignStudentPlanOutput> & { ok?: boolean };
  if (o.ok !== true) return null;
  const ok = o as Extract<DesignStudentPlanOutput, { ok: true }>;
  if (!ok.studentId || !ok.summary) return null;

  const detailParts: string[] = [];
  if (typeof ok.summary.adequacyScore === "number") {
    detailParts.push(`적합도 ${ok.summary.adequacyScore}`);
  }
  if (ok.summary.conflicts.length > 0) {
    detailParts.push(`충돌 ${ok.summary.conflicts.length}`);
  }

  return {
    tool: "designStudentPlan",
    type: "plan",
    subjectKey: ok.studentId,
    label: `${ok.studentName ?? "학생"} 수강 계획`,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : ok.summary.headline,
    originPath: `/admin/students/${ok.studentId}`,
  };
}
