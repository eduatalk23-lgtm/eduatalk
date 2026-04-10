// ============================================
// 차트 데이터 공유 유틸리티
// 리포트 + 작업 화면 양쪽에서 사용
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "./constants";
import { gradeToNum } from "./rubric-matcher";
import type {
  CompetencyScore,
  ActivityTag,
  RecordTabData,
  CompetencyArea,
  CompetencyGrade,
} from "./types";

// ============================================
// 1. 영역별 레이더 차트 데이터 (3영역 독립 차트)
// ============================================

export interface AreaRadarItem {
  code: string;
  /** 레이더 축 표시용 — 전체 라벨(자르지 않음) */
  item: string;
  AI: number;
  컨설턴트: number;
  fullMark: number;
  /** 원본 등급 문자열 — 커스텀 축 라벨에서 직접 표시 */
  aiGrade: CompetencyGrade | null;
  consultantGrade: CompetencyGrade | null;
}

export interface AreaRadarSection {
  area: CompetencyArea;
  label: string;
  items: AreaRadarItem[];
  /** 영역 평균 (컨설턴트 우선, 없으면 AI) 0~5 */
  avgScore: number;
  /** 평균 등급 문자열 */
  avgGrade: CompetencyGrade;
  /** AI↔컨설턴트 등급 불일치 항목 수 */
  mismatchCount: number;
}

const AREA_ORDER: readonly CompetencyArea[] = ["academic", "career", "community"] as const;

function scoreToGrade(score: number): CompetencyGrade {
  if (score >= 4.5) return "A+";
  if (score >= 3.5) return "A-";
  if (score >= 2.5) return "B+";
  if (score >= 1.5) return "B";
  if (score >= 0.5) return "B-";
  return "C";
}

/**
 * 3개 역량 영역(학업/진로/공동체)별 레이더 데이터 생성.
 * 각 영역은 자체 차트로 렌더링되므로 항목 라벨 중복으로 인한 축 병합 버그가 없다.
 */
export function buildAreaRadarData(
  aiScores: CompetencyScore[],
  consultantScores: CompetencyScore[],
): AreaRadarSection[] {
  const aiMap = new Map(aiScores.map((s) => [s.competency_item, s]));
  const conMap = new Map(consultantScores.map((s) => [s.competency_item, s]));

  return AREA_ORDER.map((area) => {
    const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
    let sumPreferred = 0;
    let countPreferred = 0;
    let mismatchCount = 0;

    const items: AreaRadarItem[] = areaItems.map((item) => {
      const ai = aiMap.get(item.code);
      const con = conMap.get(item.code);
      const aiVal = ai?.grade_value ? gradeToNum(ai.grade_value) : 0;
      const conVal = con?.grade_value ? gradeToNum(con.grade_value) : 0;
      const preferred = con?.grade_value ?? ai?.grade_value ?? null;

      if (preferred) {
        sumPreferred += gradeToNum(preferred);
        countPreferred++;
      }
      if (ai?.grade_value && con?.grade_value && ai.grade_value !== con.grade_value) {
        mismatchCount++;
      }

      return {
        code: item.code,
        item: item.label,
        AI: aiVal,
        컨설턴트: conVal,
        fullMark: 5,
        aiGrade: ai?.grade_value ? (ai.grade_value as CompetencyGrade) : null,
        consultantGrade: con?.grade_value ? (con.grade_value as CompetencyGrade) : null,
      };
    });

    const avgScore = countPreferred > 0 ? sumPreferred / countPreferred : 0;

    return {
      area,
      label: COMPETENCY_AREA_LABELS[area],
      items,
      avgScore: Number(avgScore.toFixed(2)),
      avgGrade: scoreToGrade(avgScore),
      mismatchCount,
    };
  });
}

// ============================================
// 2. 영역 총평 합성 (규칙 기반, LLM 미호출)
// ============================================

export interface AreaNarrativeItem {
  code: string;
  label: string;
  grade: CompetencyGrade | null;
  narrative: string | null;
}

export interface AreaNarrativeSummary {
  area: CompetencyArea;
  label: string;
  /** 영역 평균 요약 문장 — ex. "학업역량은 전반적으로 B+ 수준입니다." */
  headline: string;
  /** 최고 등급 항목 (평가된 항목이 있을 때) */
  strongest: { label: string; grade: CompetencyGrade } | null;
  /** 최저 등급 항목 (평가된 항목이 있을 때) */
  weakest: { label: string; grade: CompetencyGrade } | null;
  /** 모든 하위 항목의 등급·narrative */
  items: AreaNarrativeItem[];
}

/**
 * 영역별 총평을 item-level narrative + 등급에서 규칙 기반으로 합성.
 * 옵션 A: LLM 재호출 없이 기존 저장된 데이터만 사용.
 */
export function composeAreaNarratives(
  aiScores: CompetencyScore[],
  consultantScores: CompetencyScore[],
): AreaNarrativeSummary[] {
  const aiMap = new Map(aiScores.map((s) => [s.competency_item, s]));
  const conMap = new Map(consultantScores.map((s) => [s.competency_item, s]));

  return AREA_ORDER.map((area) => {
    const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
    const items: AreaNarrativeItem[] = areaItems.map((item) => {
      const con = conMap.get(item.code);
      const ai = aiMap.get(item.code);
      const picked = con ?? ai;
      return {
        code: item.code,
        label: item.label,
        grade: picked?.grade_value ? (picked.grade_value as CompetencyGrade) : null,
        narrative: picked?.narrative ?? null,
      };
    });

    // 등급이 있는 항목만 추려 min/max 계산
    const graded = items.filter((i): i is AreaNarrativeItem & { grade: CompetencyGrade } => !!i.grade);
    let strongest: { label: string; grade: CompetencyGrade } | null = null;
    let weakest: { label: string; grade: CompetencyGrade } | null = null;
    if (graded.length > 0) {
      const sorted = [...graded].sort((a, b) => gradeToNum(b.grade) - gradeToNum(a.grade));
      strongest = { label: sorted[0].label, grade: sorted[0].grade };
      // 최저는 최고와 다를 때만 제시 (동일하면 의미 없음)
      const last = sorted[sorted.length - 1];
      if (last && last.label !== strongest.label) {
        weakest = { label: last.label, grade: last.grade };
      }
    }

    const avgScore = graded.length > 0
      ? graded.reduce((s, i) => s + gradeToNum(i.grade), 0) / graded.length
      : 0;
    const avgGrade = scoreToGrade(avgScore);
    const label = COMPETENCY_AREA_LABELS[area];
    const headline = graded.length === 0
      ? `${label} 평가 데이터가 아직 없습니다.`
      : `${label}은(는) 전반적으로 ${avgGrade} 수준입니다.`;

    return {
      area,
      label,
      headline,
      strongest,
      weakest,
      items,
    };
  });
}

// ============================================
// 3. 성장 추이 데이터
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
// 4. 전략 매트릭스 데이터
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
