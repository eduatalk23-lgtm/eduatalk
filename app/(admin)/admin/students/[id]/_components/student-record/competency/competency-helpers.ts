// ============================================
// 역량 분석 헬퍼 — 순수 함수 + 로컬 타입
// 서버/클라이언트 모두 사용 가능 (directive 없음)
// ============================================

import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade } from "@/lib/domains/student-record";
import type { RubricScoreEntry } from "@/lib/domains/student-record/types";

export type RecordForHighlight = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

export type TagsByRecord = {
  recordId: string;
  recordLabel: string;
  grade: number;
  tags: ActivityTag[];
};

export type TagStatsGrouped = {
  positive: number;
  negative: number;
  needs_review: number;
  recordCount: number;
  byGrade: Map<number, TagsByRecord[]>;
};

export type RecordLabelMap = Map<string, { label: string; grade: number }>;

export const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
export const AREAS: CompetencyArea[] = ["academic", "career", "community"];

export function findScore(scores: CompetencyScore[], code: string): string {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.grade_value ?? "";
}

export function findNarrative(scores: CompetencyScore[], code: string): string | null {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.narrative ?? null;
}

export function findRubricScores(scores: CompetencyScore[], code: string, source: string): RubricScoreEntry[] {
  const score = scores.find((s) => s.competency_item === code && s.scope === "yearly" && s.source === source);
  if (!score?.rubric_scores || !Array.isArray(score.rubric_scores)) return [];
  return score.rubric_scores as unknown as RubricScoreEntry[];
}

export function countTagsByItem(tags: ActivityTag[], recordLabelMap: RecordLabelMap): Map<string, TagStatsGrouped> {
  const map = new Map<string, TagStatsGrouped>();
  for (const tag of tags) {
    const key = tag.competency_item;
    const entry = map.get(key) ?? {
      positive: 0,
      negative: 0,
      needs_review: 0,
      recordCount: 0,
      byGrade: new Map<number, TagsByRecord[]>(),
    };
    if (tag.evaluation === "positive") entry.positive++;
    else if (tag.evaluation === "negative") entry.negative++;
    else entry.needs_review++;

    // 학년 → 레코드 그룹핑
    const recInfo = recordLabelMap.get(tag.record_id);
    const grade = recInfo?.grade ?? 0;
    const recordLabel = recInfo?.label ?? tag.record_type;

    if (!entry.byGrade.has(grade)) entry.byGrade.set(grade, []);
    const gradeRecords = entry.byGrade.get(grade)!;
    let recordGroup = gradeRecords.find((rg: TagsByRecord) => rg.recordId === tag.record_id);
    if (!recordGroup) {
      recordGroup = { recordId: tag.record_id, recordLabel, grade, tags: [] };
      gradeRecords.push(recordGroup);
    }
    recordGroup.tags.push(tag);

    map.set(key, entry);
  }
  // recordCount 계산
  for (const entry of map.values()) {
    let count = 0;
    for (const records of entry.byGrade.values()) count += records.length;
    entry.recordCount = count;
  }
  return map;
}
