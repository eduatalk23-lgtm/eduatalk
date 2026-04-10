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
// 4. 학기별 성장 추이 데이터
// ============================================

export interface SemesterGrowthDataPoint {
  학기: string; // "1-1" | "1-2" | "2-1" | ...
  [areaLabel: string]: string | number;
}

/** 학기 범위 제한 옵션 (수시 범위: 기본 마지막 학년 1학기까지) */
export interface SemesterRangeOptions {
  /** 표시할 최대 학기. 이 학기까지만 포함. 예: { grade: 3, semester: 1 } → 3-2 제외 */
  maxSemester?: { grade: number; semester: number };
  /**
   * 내신 성적 기반 학기 보정 맵.
   * NEIS가 세특을 학기 구분 없이 semester=1로 임포트한 경우,
   * 이 맵으로 (grade, subject_id)의 실제 학기를 복원.
   * key = "grade:subjectId", value = semester.
   * `buildSubjectSemesterMap(internalScores)`로 생성.
   */
  subjectSemesterMap?: SubjectSemesterMap;
}

/** 학기 키("3-2")가 maxSemester 범위 안인지 확인 */
function isWithinRange(semKey: string, max?: { grade: number; semester: number }): boolean {
  if (!max) return true;
  const [g, s] = semKey.split("-").map(Number);
  return g < max.grade || (g === max.grade && s <= max.semester);
}

/**
 * 내신 성적의 학기 정보로 세특 record_id의 학기를 보정.
 * NEIS가 세특을 학기 구분 없이 전부 semester=1로 임포트하는 경우,
 * 성적 데이터의 (grade, subject_id) → semester 매핑을 사용해 실제 학기를 복원.
 * key = "grade:subjectId", value = semester (1 or 2)
 */
export type SubjectSemesterMap = Record<string, number>;

/**
 * 내신 성적 배열에서 SubjectSemesterMap 생성.
 * 한 과목이 한 학년에서 한 학기에만 성적이 있으면 → 해당 학기로 확정.
 * 양 학기 다 있으면 → 맵에 포함하지 않음 (setek.semester 원본 유지).
 * 이렇게 해야 "2학기 전용 과목"의 세특이 올바른 학기로 보정됨.
 */
export function buildSubjectSemesterMap(
  scores: Array<{ grade?: number | null; semester?: number | null; subject_id?: string | null }>,
): SubjectSemesterMap {
  // 먼저 (grade, subject_id)별 학기 집합 수집
  const semSets = new Map<string, Set<number>>();
  for (const s of scores) {
    if (s.grade && s.semester && s.subject_id) {
      const key = `${s.grade}:${s.subject_id}`;
      const set = semSets.get(key) ?? new Set();
      set.add(s.semester);
      semSets.set(key, set);
    }
  }

  // 한 학기에만 성적이 있는 과목만 맵에 포함
  const map: SubjectSemesterMap = {};
  for (const [key, sems] of semSets) {
    if (sems.size === 1) {
      map[key] = [...sems][0];
    }
    // 양 학기 다 있으면 맵에 넣지 않음 → setek.semester 원본(DB 값) 유지
  }
  return map;
}

/**
 * recordDataByGrade에서 record_id → { grade, semester } 매핑 + gradeSemesters 집합 구축.
 * 3개 빌더(growth, heatmap, boxplot)에서 공통 사용.
 */
export function buildRecordSemesterMapping(
  recordDataByGrade: Record<number, RecordTabData>,
  semMap?: SubjectSemesterMap,
): { recordSemesterMap: Map<string, { grade: number; semester: number }>; gradeSemesters: Set<string> } {
  const recordSemesterMap = new Map<string, { grade: number; semester: number }>();
  const gradeSemesters = new Set<string>();

  for (const [gradeStr, tabData] of Object.entries(recordDataByGrade)) {
    const grade = Number(gradeStr);
    if (!tabData) continue;
    for (const s of tabData.seteks ?? []) {
      const correctedSem = semMap?.[`${grade}:${s.subject_id}`] ?? s.semester;
      recordSemesterMap.set(s.id, { grade, semester: correctedSem });
      gradeSemesters.add(`${grade}-${correctedSem}`);
    }
    for (const ps of tabData.personalSeteks ?? []) {
      recordSemesterMap.set(ps.id, { grade, semester: 0 });
    }
    for (const c of tabData.changche ?? []) {
      recordSemesterMap.set(c.id, { grade, semester: 0 });
    }
    if (tabData.haengteuk) {
      recordSemesterMap.set(tabData.haengteuk.id, { grade, semester: 0 });
    }
  }

  return { recordSemesterMap, gradeSemesters };
}

/**
 * 학기별 역량 성장 추이.
 * buildGrowthData()의 학기 확장 버전 — X축이 학년(3점) → 학기(최대 6점).
 * changche/haengteuk는 semester가 없으므로 해당 학년의 양 학기에 균등 분배.
 */
export function buildSemesterGrowthData(
  activityTags: ActivityTag[],
  recordDataByGrade: Record<number, RecordTabData>,
  options?: SemesterRangeOptions,
): { data: SemesterGrowthDataPoint[] | null; annotations: GrowthAnnotation[] | null } {
  if (activityTags.length === 0) return { data: null, annotations: null };

  const { recordSemesterMap, gradeSemesters } = buildRecordSemesterMapping(
    recordDataByGrade, options?.subjectSemesterMap,
  );

  // 학기별 항목별 집계
  type CountEntry = { positive: number; total: number };
  const semItemCounts = new Map<string, CountEntry>();

  for (const tag of activityTags) {
    const info = recordSemesterMap.get(tag.record_id);
    if (!info) continue;

    const targetSemesters =
      info.semester === 0
        ? [1, 2].filter((s) => gradeSemesters.has(`${info.grade}-${s}`))
        : [info.semester];

    // semester=0 인데 해당 학년에 학기 데이터가 없으면 1학기로 폴백
    if (targetSemesters.length === 0) targetSemesters.push(1);

    for (const sem of targetSemesters) {
      const key = `${info.grade}-${sem}:${tag.competency_item}`;
      const entry = semItemCounts.get(key) ?? { positive: 0, total: 0 };
      entry.total++;
      if (tag.evaluation === "positive") entry.positive++;
      semItemCounts.set(key, entry);
    }
  }

  // 실제 존재하는 학기 추출 (maxSemester 범위 적용)
  const semesterKeys = [...gradeSemesters]
    .filter((k) => isWithinRange(k, options?.maxSemester))
    .map((k) => {
      const [g, s] = k.split("-").map(Number);
      return { grade: g, semester: s, label: `${g}-${s}` };
    })
    .sort((a, b) => a.grade - b.grade || a.semester - b.semester);

  if (semesterKeys.length < 2) return { data: null, annotations: null };

  const areas = ["academic", "career", "community"] as const;

  const data: SemesterGrowthDataPoint[] = semesterKeys.map(({ grade, semester, label }) => {
    const point: SemesterGrowthDataPoint = { 학기: label };
    for (const area of areas) {
      const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
      let sum = 0;
      let count = 0;
      for (const item of areaItems) {
        const entry = semItemCounts.get(`${grade}-${semester}:${item.code}`);
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

  // 주석: 학기별 대표 positive 항목
  const annotations: GrowthAnnotation[] = semesterKeys.map(({ grade, semester }) => {
    const anns = areas
      .map((area) => {
        const areaItems = COMPETENCY_ITEMS.filter((i) => i.area === area);
        let best = { label: "", count: 0 };
        for (const item of areaItems) {
          const entry = semItemCounts.get(`${grade}-${semester}:${item.code}`);
          if (entry && entry.positive > best.count) {
            best = { label: item.label, count: entry.positive };
          }
        }
        return best.count > 0 ? `${best.label}↑${best.count > 1 ? best.count : ""}` : null;
      })
      .filter(Boolean) as string[];
    return { grade, annotations: anns };
  });

  return { data, annotations };
}

// ============================================
// 5. 학기별 역량 히트맵 데이터
// ============================================

export interface SemesterHeatmapCell {
  score: number; // 0-5 (positive ratio × 5)
  positive: number;
  total: number;
}

export interface SemesterHeatmapData {
  semesters: string[]; // ["1-1", "1-2", ...]
  items: Array<{
    code: string;
    label: string;
    area: CompetencyArea;
    cells: Record<string, SemesterHeatmapCell | null>; // key = "1-1" etc
  }>;
}

/** 10개 역량 항목 × 학기별 positive 비율 히트맵 */
export function buildSemesterHeatmapData(
  activityTags: ActivityTag[],
  recordDataByGrade: Record<number, RecordTabData>,
  options?: SemesterRangeOptions,
): SemesterHeatmapData | null {
  if (activityTags.length === 0) return null;

  const { recordSemesterMap, gradeSemesters } = buildRecordSemesterMapping(
    recordDataByGrade, options?.subjectSemesterMap,
  );

  const semesterKeys = [...gradeSemesters]
    .filter((k) => isWithinRange(k, options?.maxSemester))
    .map((k) => {
      const [g, s] = k.split("-").map(Number);
      return { grade: g, semester: s, label: `${g}-${s}` };
    })
    .sort((a, b) => a.grade - b.grade || a.semester - b.semester);

  if (semesterKeys.length < 2) return null;

  // 학기×항목별 집계
  const counts = new Map<string, { positive: number; total: number }>();
  for (const tag of activityTags) {
    const info = recordSemesterMap.get(tag.record_id);
    if (!info) continue;
    const targetSems =
      info.semester === 0
        ? [1, 2].filter((s) => gradeSemesters.has(`${info.grade}-${s}`))
        : [info.semester];
    if (targetSems.length === 0) targetSems.push(1);
    for (const sem of targetSems) {
      const key = `${info.grade}-${sem}:${tag.competency_item}`;
      const entry = counts.get(key) ?? { positive: 0, total: 0 };
      entry.total++;
      if (tag.evaluation === "positive") entry.positive++;
      counts.set(key, entry);
    }
  }

  const semesters = semesterKeys.map((k) => k.label);
  const items = COMPETENCY_ITEMS.map((item) => ({
    code: item.code,
    label: item.label,
    area: item.area as CompetencyArea,
    cells: Object.fromEntries(
      semesterKeys.map(({ label }) => {
        const entry = counts.get(`${label}:${item.code}`);
        if (!entry || entry.total === 0) return [label, null];
        return [
          label,
          {
            score: Number(((entry.positive / entry.total) * 5).toFixed(1)),
            positive: entry.positive,
            total: entry.total,
          },
        ];
      }),
    ) as Record<string, SemesterHeatmapCell | null>,
  }));

  return { semesters, items };
}

// ============================================
// 6. 학기별 콘텐츠 품질 Box Plot 데이터
// ============================================

export interface ContentQualityWithSemester {
  record_id: string;
  record_type: string;
  grade: number;
  semester: number; // 0 for changche/haengteuk
  subject_id?: string;
  overall_score: number;
  specificity: number;
  coherence: number;
  depth: number;
  grammar: number;
  scientific_validity: number | null;
}

export interface QualityBoxDataPoint {
  학기: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  count: number;
  outliers: Array<{ score: number; subjectName: string }>;
}

export interface QualityAxisTrend {
  학기: string;
  구체성: number;
  논리연결: number;
  탐구깊이: number;
  문법: number;
  연구정합성: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * 학기별 과목 품질 분포 Box Plot + 5축 추이.
 * setek만 사용 (changche/haengteuk는 과목 단위가 아니므로 box에 부적합).
 */
export function buildSemesterQualityBoxData(
  qualityData: ContentQualityWithSemester[],
  subjectNamesById: Record<string, string>,
  options?: SemesterRangeOptions,
): { boxes: QualityBoxDataPoint[] | null; axisTrends: QualityAxisTrend[] | null } {
  // setek만 필터 (semester > 0)
  const setekOnly = qualityData.filter(
    (q) => (q.record_type === "setek" || q.record_type === "personal_setek") && q.semester > 0,
  );
  if (setekOnly.length === 0) return { boxes: null, axisTrends: null };

  // 학기별 그룹
  const groups = new Map<string, ContentQualityWithSemester[]>();
  for (const q of setekOnly) {
    const key = `${q.grade}-${q.semester}`;
    const list = groups.get(key) ?? [];
    list.push(q);
    groups.set(key, list);
  }

  const semesterKeys = [...groups.keys()]
    .filter((k) => isWithinRange(k, options?.maxSemester))
    .map((k) => {
      const [g, s] = k.split("-").map(Number);
      return { grade: g, semester: s, label: k };
    })
    .sort((a, b) => a.grade - b.grade || a.semester - b.semester);

  if (semesterKeys.length < 2) return { boxes: null, axisTrends: null };

  const boxes: QualityBoxDataPoint[] = semesterKeys.map(({ label }) => {
    const items = groups.get(label)!;
    const scores = items.map((q) => q.overall_score).sort((a, b) => a - b);

    const q1 = percentile(scores, 0.25);
    const med = percentile(scores, 0.5);
    const q3 = percentile(scores, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    const outliers = items
      .filter((q) => q.overall_score < lowerFence || q.overall_score > upperFence)
      .map((q) => ({
        score: q.overall_score,
        subjectName: q.subject_id ? (subjectNamesById[q.subject_id] ?? "알 수 없음") : "알 수 없음",
      }));

    const nonOutlierScores = scores.filter((s) => s >= lowerFence && s <= upperFence);

    return {
      학기: label,
      min: nonOutlierScores.length > 0 ? nonOutlierScores[0] : scores[0],
      q1,
      median: med,
      q3,
      max:
        nonOutlierScores.length > 0
          ? nonOutlierScores[nonOutlierScores.length - 1]
          : scores[scores.length - 1],
      mean: Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)),
      count: scores.length,
      outliers,
    };
  });

  const axisTrends: QualityAxisTrend[] = semesterKeys.map(({ label }) => {
    const items = groups.get(label)!;
    const avg = (arr: number[]) => (arr.length > 0 ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)) : 0);
    const svValues = items.map((q) => q.scientific_validity).filter((v): v is number => v != null);
    return {
      학기: label,
      구체성: avg(items.map((q) => q.specificity)),
      논리연결: avg(items.map((q) => q.coherence)),
      탐구깊이: avg(items.map((q) => q.depth)),
      문법: avg(items.map((q) => q.grammar)),
      연구정합성: svValues.length > 0 ? avg(svValues) : null,
    };
  });

  return { boxes, axisTrends };
}

// ============================================
// 7. 전략 매트릭스 데이터
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
