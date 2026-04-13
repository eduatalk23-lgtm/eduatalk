// ============================================
// L4-E: 서사 기반 설계 모드 — 분석 컨텍스트
// 컨설턴트가 "어떤 활동을 먼저 보강해야 하나"를 결정할 수 있도록
// 이미 영속화된 reportData에서 약점·우선순위를 합성한다.
//
// 입력은 모두 reportData(이미 fetchReportData가 빌드한 SoT)에서 가져오며,
// 추가 DB 쿼리를 발생시키지 않는다(설계 모드 미리보기 SSR 비용 0).
// ============================================

import type { ReportData } from "@/lib/domains/student-record/report/actions";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import type { CompetencyArea } from "@/lib/domains/student-record/types";

// ============================================
// 타입
// ============================================

export interface PrioritizedWeakness {
  /** 출처 — `competency`(역량 등급) / `issue`(품질 이슈 코드) */
  source: "competency" | "issue";
  /** competency_item 코드 또는 issue 코드 */
  code: string;
  /** 사람이 읽을 수 있는 라벨 */
  label: string;
  /** 보강 시급도 */
  severity: "high" | "medium" | "low";
  /** competency 출처일 때만 채워짐 */
  area?: CompetencyArea;
  /** 우선 보강 사유(컨설턴트용 한 줄 설명) */
  rationale: string;
  /** 정렬 보조: severity 가중치 (high=3 / medium=2 / low=1) */
  weight: number;
}

export interface RecordPriority {
  recordType: "setek" | "changche" | "haengteuk";
  recordId: string;
  schoolYear: number;
  grade: number;
  /** UI 표기 라벨 */
  label: string;
  /** 세특이면 과목명 */
  subjectName?: string;
  /** 0~100 점수 (100 = 최우선) */
  priority: number;
  /** 우선순위 사유 (높은 기여순) */
  reasons: string[];
  /** AI 가안 미작성 여부 */
  isEmpty: boolean;
}

export interface NarrativeContext {
  /** 보강 우선순위 약점 (severity 내림차순) */
  prioritizedWeaknesses: PrioritizedWeakness[];
  /** 설계 학년 레코드 우선순위 (priority 내림차순) */
  recordPriorityOrder: RecordPriority[];
}

// ============================================
// 점수·라벨 상수
// ============================================

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;
const SEVERITY_BONUS = { high: 15, medium: 10, low: 5 } as const;
const AREA_BONUS_CAP = 30;
const CAREER_SUBJECT_BONUS = 20;
const EMPTY_DRAFT_BONUS = 10;
const BASE_PRIORITY = 50;

/** 활동 유형 → 어떤 competency area 약점이 우선 매칭되는가 */
const CHANGCHE_AREA_MAP: Record<string, ReadonlySet<CompetencyArea>> = {
  autonomy: new Set<CompetencyArea>(["community"]),
  club: new Set<CompetencyArea>(["career", "community"]),
  career: new Set<CompetencyArea>(["career", "community"]),
};

const ACTIVITY_LABELS: Record<string, string> = {
  autonomy: "자율활동",
  club: "동아리활동",
  career: "진로활동",
};

const COMPETENCY_LABEL_BY_CODE = new Map<string, { label: string; area: CompetencyArea }>(
  COMPETENCY_ITEMS.map((item) => [item.code, { label: item.label, area: item.area }]),
);

// ============================================
// Builder
// ============================================

/**
 * 설계 학년의 레코드와 보강 우선순위 약점을 합성한다.
 * - `designGrades`가 비었거나 reportData에 데이터가 부족하면 undefined.
 * - 예외는 던지지 않는다(렌더링 경로용 — 항상 graceful).
 */
export function buildNarrativeContext(
  reportData: ReportData,
  designGrades: number[],
): NarrativeContext | undefined {
  if (!designGrades || designGrades.length === 0) return undefined;
  try {
    const prioritizedWeaknesses = computePrioritizedWeaknesses(reportData);
    const recordPriorityOrder = computeRecordPriority(reportData, designGrades, prioritizedWeaknesses);
    if (prioritizedWeaknesses.length === 0 && recordPriorityOrder.length === 0) return undefined;
    return { prioritizedWeaknesses, recordPriorityOrder };
  } catch {
    return undefined;
  }
}

// ─── 1. 약점 우선순위 ───

function competencySeverity(grade: string): "high" | "medium" | null {
  if (grade === "C") return "high";
  if (grade === "B-") return "medium";
  return null;
}

function issueSeverity(count: number): "high" | "medium" | "low" | null {
  if (count <= 0) return null;
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}

/**
 * 약점 우선순위 합성 — pipeline path와 reportData path 양쪽 재사용.
 *
 * @param weakCompetencies B-/C 등급 역량 (item, grade, reasoning)
 * @param issuesPerRecord  레코드별 issue code 배열 (length가 곧 빈도 집계 대상)
 */
export function computePrioritizedWeaknessesFromInputs(
  weakCompetencies: Array<{ item: string; grade: string; reasoning?: string | null }>,
  issuesPerRecord: Array<string[] | null | undefined>,
): PrioritizedWeakness[] {
  const out: PrioritizedWeakness[] = [];

  for (const w of weakCompetencies) {
    const sev = competencySeverity(w.grade);
    if (!sev) continue;
    const meta = COMPETENCY_LABEL_BY_CODE.get(w.item);
    const label = meta?.label ?? w.item;
    const reasoning = w.reasoning ? ` — ${w.reasoning.slice(0, 80)}` : "";
    out.push({
      source: "competency",
      code: w.item,
      label,
      severity: sev,
      ...(meta?.area ? { area: meta.area } : {}),
      rationale: `${w.grade} 등급으로 평가됨${reasoning}`,
      weight: SEVERITY_WEIGHT[sev],
    });
  }

  const issueCount = new Map<string, number>();
  for (const issues of issuesPerRecord) {
    for (const code of issues ?? []) {
      issueCount.set(code, (issueCount.get(code) ?? 0) + 1);
    }
  }
  for (const [code, count] of issueCount) {
    const sev = issueSeverity(count);
    if (!sev) continue;
    out.push({
      source: "issue",
      code,
      label: code,
      severity: sev,
      rationale: `총 ${count}건의 레코드에서 반복 감지`,
      weight: SEVERITY_WEIGHT[sev],
    });
  }

  out.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.source !== b.source) return a.source === "competency" ? -1 : 1;
    return a.code.localeCompare(b.code);
  });
  return out;
}

function computePrioritizedWeaknesses(reportData: ReportData): PrioritizedWeakness[] {
  return computePrioritizedWeaknessesFromInputs(
    reportData.weakCompetencyContexts ?? [],
    (reportData.contentQuality ?? []).map((q) => q.issues ?? []),
  );
}

// ─── 2. 레코드 우선순위 ───

interface RecordCandidate {
  recordType: "setek" | "changche" | "haengteuk";
  recordId: string;
  schoolYear: number;
  grade: number;
  label: string;
  subjectName?: string;
  isCareerSubject: boolean;
  /** 어떤 area 약점이 매칭되는가 */
  matchedAreas: ReadonlySet<CompetencyArea>;
  isEmpty: boolean;
}

function buildCareerSubjectIdSet(reportData: ReportData): Set<string> {
  const career = new Set<string>();
  for (const cp of reportData.coursePlans ?? []) {
    const typeName = cp.subject?.subject_type?.name ?? "";
    if (typeName.includes("진로") || typeName.includes("전문")) {
      career.add(cp.subject_id);
    }
  }
  return career;
}

function collectCandidates(reportData: ReportData, designGrades: number[]): RecordCandidate[] {
  const careerSubjects = buildCareerSubjectIdSet(reportData);
  const out: RecordCandidate[] = [];
  const setekAreas = new Set<CompetencyArea>(["academic", "career"]);
  const haengteukAreas = new Set<CompetencyArea>(["academic", "community"]);

  for (const g of designGrades) {
    const tab = reportData.recordDataByGrade?.[g];
    if (!tab) continue;

    for (const s of tab.seteks ?? []) {
      const subjectName = reportData.subjectNamesById?.[s.subject_id] ?? undefined;
      const subjectLabel = subjectName ?? "과목";
      out.push({
        recordType: "setek",
        recordId: s.id,
        schoolYear: s.school_year,
        grade: s.grade,
        label: `${subjectLabel} ${s.semester}학기`,
        ...(subjectName ? { subjectName } : {}),
        isCareerSubject: careerSubjects.has(s.subject_id),
        matchedAreas: setekAreas,
        isEmpty: !((s.ai_draft_content ?? "").trim() || (s.content ?? "").trim()),
      });
    }
    for (const c of tab.changche ?? []) {
      const label = ACTIVITY_LABELS[c.activity_type] ?? c.activity_type;
      out.push({
        recordType: "changche",
        recordId: c.id,
        schoolYear: c.school_year,
        grade: c.grade,
        label,
        isCareerSubject: false,
        matchedAreas: CHANGCHE_AREA_MAP[c.activity_type] ?? new Set<CompetencyArea>(),
        isEmpty: !((c.ai_draft_content ?? "").trim() || (c.content ?? "").trim()),
      });
    }
    if (tab.haengteuk) {
      const h = tab.haengteuk;
      out.push({
        recordType: "haengteuk",
        recordId: h.id,
        schoolYear: h.school_year,
        grade: h.grade,
        label: "행동특성 및 종합의견",
        isCareerSubject: false,
        matchedAreas: haengteukAreas,
        isEmpty: !((h.ai_draft_content ?? "").trim() || (h.content ?? "").trim()),
      });
    }
  }
  return out;
}

function scoreCandidate(
  cand: RecordCandidate,
  weaknesses: PrioritizedWeakness[],
): { priority: number; reasons: string[] } {
  let score = BASE_PRIORITY;
  const reasons: string[] = [];

  // 진로교과 보너스 (세특에만 의미 있음)
  if (cand.isCareerSubject) {
    score += CAREER_SUBJECT_BONUS;
    reasons.push("진로교과");
  }

  // 약점 area 매칭 — 가중치 부여
  let areaBonus = 0;
  const matchedLabels: string[] = [];
  for (const w of weaknesses) {
    if (w.source !== "competency" || !w.area) continue;
    if (!cand.matchedAreas.has(w.area)) continue;
    areaBonus += SEVERITY_BONUS[w.severity];
    matchedLabels.push(w.label);
    if (areaBonus >= AREA_BONUS_CAP) break;
  }
  if (areaBonus > 0) {
    score += Math.min(areaBonus, AREA_BONUS_CAP);
    const head = matchedLabels.slice(0, 2).join("/");
    reasons.push(`약점 보강(${head})`);
  }

  // 미작성 가안은 시급
  if (cand.isEmpty) {
    score += EMPTY_DRAFT_BONUS;
    reasons.push("가안 미작성");
  }

  return { priority: Math.min(100, score), reasons };
}

function computeRecordPriority(
  reportData: ReportData,
  designGrades: number[],
  weaknesses: PrioritizedWeakness[],
): RecordPriority[] {
  const candidates = collectCandidates(reportData, designGrades);
  if (candidates.length === 0) return [];

  const scored: RecordPriority[] = candidates.map((c) => {
    const { priority, reasons } = scoreCandidate(c, weaknesses);
    return {
      recordType: c.recordType,
      recordId: c.recordId,
      schoolYear: c.schoolYear,
      grade: c.grade,
      label: c.label,
      ...(c.subjectName ? { subjectName: c.subjectName } : {}),
      priority,
      reasons,
      isEmpty: c.isEmpty,
    };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.recordId.localeCompare(b.recordId);
  });
  return scored;
}
