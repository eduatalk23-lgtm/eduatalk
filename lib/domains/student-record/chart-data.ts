// ============================================
// 차트 데이터 공유 유틸리티
// 리포트 + 작업 화면 양쪽에서 사용
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "./constants";
import { gradeToNum } from "./rubric-matcher";
import type { CompetencyScore, ActivityTag, RecordTabData, Strategy } from "./types";

// ============================================
// 1. 레이더 차트 데이터
// ============================================

export interface RadarDataPoint {
  item: string;
  AI: number;
  컨설턴트: number;
  fullMark: number;
}

/** 10개 역량 항목의 레이더 차트 데이터 생성 (컨설턴트 우선) */
export function buildRadarData(
  aiScores: CompetencyScore[],
  consultantScores: CompetencyScore[],
): RadarDataPoint[] {
  const aiMap = new Map(aiScores.map((s) => [s.competency_item, s]));
  const conMap = new Map(consultantScores.map((s) => [s.competency_item, s]));

  return COMPETENCY_ITEMS.map((item) => {
    const ai = aiMap.get(item.code);
    const con = conMap.get(item.code);
    return {
      item: item.label,
      AI: ai?.grade_value ? gradeToNum(ai.grade_value) : 0,
      컨설턴트: con?.grade_value ? gradeToNum(con.grade_value) : 0,
      fullMark: 5,
    };
  });
}

/** 단일 소스 레이더 (컨설턴트 우선 fallback) */
export function buildSingleRadarData(
  aiScores: CompetencyScore[],
  consultantScores: CompetencyScore[],
): Array<{ item: string; 점수: number; fullMark: number }> {
  const aiMap = new Map(aiScores.map((s) => [s.competency_item, s]));
  const conMap = new Map(consultantScores.map((s) => [s.competency_item, s]));

  return COMPETENCY_ITEMS.map((item) => {
    const score = conMap.get(item.code) ?? aiMap.get(item.code);
    return {
      item: item.label,
      점수: score?.grade_value ? gradeToNum(score.grade_value) : 0,
      fullMark: 5,
    };
  });
}

// ============================================
// 2. 성장 추이 데이터
// ============================================

export interface GrowthDataPoint {
  학년: string;
  [areaLabel: string]: string | number;
}

export interface GrowthAnnotation {
  grade: number;
  annotations: string[];
}

/** 학년별 영역 평균 성장 추이 + 대표 활동 주석 */
export function buildGrowthData(
  activityTags: ActivityTag[],
  recordDataByGrade: Record<number, RecordTabData>,
): { data: GrowthDataPoint[] | null; annotations: GrowthAnnotation[] | null } {
  if (activityTags.length === 0) return { data: null, annotations: null };

  // record_id → grade 매핑
  const recordGradeMap = new Map<string, number>();
  for (const [gradeStr, tabData] of Object.entries(recordDataByGrade)) {
    const grade = Number(gradeStr);
    if (!tabData) continue;
    for (const s of tabData.seteks ?? []) recordGradeMap.set(s.id, grade);
    for (const ps of tabData.personalSeteks ?? []) recordGradeMap.set(ps.id, grade);
    for (const c of tabData.changche ?? []) recordGradeMap.set(c.id, grade);
    if (tabData.haengteuk) recordGradeMap.set(tabData.haengteuk.id, grade);
  }

  // 학년별 항목별 집계
  const gradeItemCounts = new Map<string, { positive: number; total: number }>();
  for (const tag of activityTags) {
    const grade = recordGradeMap.get(tag.record_id);
    if (!grade) continue;
    const key = `${grade}:${tag.competency_item}`;
    const entry = gradeItemCounts.get(key) ?? { positive: 0, total: 0 };
    entry.total++;
    if (tag.evaluation === "positive") entry.positive++;
    gradeItemCounts.set(key, entry);
  }

  const grades = [...new Set([...recordGradeMap.values()])].sort();
  if (grades.length < 2) return { data: null, annotations: null };

  const areas = ["academic", "career", "community"] as const;

  // 성장 추이 데이터
  const data = grades.map((grade) => {
    const point: GrowthDataPoint = { 학년: `${grade}학년` };
    for (const area of areas) {
      const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
      let sum = 0;
      let count = 0;
      for (const item of areaItems) {
        const entry = gradeItemCounts.get(`${grade}:${item.code}`);
        if (entry && entry.total > 0) {
          sum += (entry.positive / entry.total) * 5;
          count++;
        }
      }
      if (count > 0) {
        point[COMPETENCY_AREA_LABELS[area]] = Number((sum / count).toFixed(1));
      }
    }
    return point;
  });

  // 대표 활동 주석
  const gradeAreaCounts = new Map<string, Map<string, number>>();
  for (const tag of activityTags) {
    if (tag.evaluation !== "positive") continue;
    const grade = recordGradeMap.get(tag.record_id);
    if (!grade) continue;
    const item = COMPETENCY_ITEMS.find((i) => i.code === tag.competency_item);
    if (!item) continue;
    const areaKey = `${grade}:${item.area}`;
    const itemCounts = gradeAreaCounts.get(areaKey) ?? new Map<string, number>();
    itemCounts.set(item.label, (itemCounts.get(item.label) ?? 0) + 1);
    gradeAreaCounts.set(areaKey, itemCounts);
  }

  const annotations = grades.map((grade) => ({
    grade,
    annotations: areas.map((area) => {
      const itemCounts = gradeAreaCounts.get(`${grade}:${area}`);
      if (!itemCounts) return null;
      let best = { label: "", count: 0 };
      for (const [label, count] of itemCounts) {
        if (count > best.count) best = { label, count };
      }
      return best.count > 0 ? `${best.label}↑${best.count > 1 ? best.count : ""}` : null;
    }).filter(Boolean) as string[],
  }));

  return { data, annotations };
}

// ============================================
// 3. 전략 매트릭스 데이터
// ============================================

export interface MatrixCell {
  priority: string;
  status: string;
}

/** 전략을 영역×우선순위 매트릭스로 변환 */
export function buildPriorityMatrixData(
  strategies: Array<{ target_area: string | null; priority: string | null; status: string }>,
): { usedAreas: string[]; matrix: Map<string, MatrixCell[]> } {
  const usedAreas = [...new Set(strategies.map((s) => s.target_area).filter(Boolean))] as string[];
  const matrix = new Map<string, MatrixCell[]>();

  for (const s of strategies) {
    const key = `${s.target_area}:${s.priority}`;
    const list = matrix.get(key) ?? [];
    list.push({ priority: s.priority ?? "low", status: s.status });
    matrix.set(key, list);
  }

  return { usedAreas, matrix };
}
