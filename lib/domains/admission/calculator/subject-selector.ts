// ============================================
// 과목 선택 로직
// Phase 8.2 — Math MAX, Inquiry top-N, 대체
// ============================================

import type { SuneungScores, UniversityScoreConfig, ConversionTable, ResolvedScores, SubjectSlot } from "./types";
import { SCIENCE_INQUIRY, SOCIAL_INQUIRY, MATH_VARIANTS } from "./constants";

/** 변환 테이블에서 과목+점수 → 환산점수 조회 */
function lookup(table: ConversionTable, subject: string, rawScore: number): number {
  return table.get(`${subject}-${rawScore}`) ?? 0;
}

/** 수학 MAX 선택: 미적/기하/확통 중 config에 맞는 최고 환산점수 */
function resolveMath(
  scores: SuneungScores,
  config: UniversityScoreConfig,
  table: ConversionTable,
): { variant: string; raw: number; converted: number } {
  const candidates: { variant: string; raw: number; converted: number }[] = [];

  const variants: { key: keyof SuneungScores; name: string; allowed: boolean }[] = [
    { key: "mathCalculus", name: "미적분", allowed: config.mathSelection !== "na" },
    { key: "mathGeometry", name: "기하", allowed: config.mathSelection !== "na" },
    { key: "mathStatistics", name: "확률과통계", allowed: config.mathSelection !== "ga" },
  ];

  for (const v of variants) {
    if (!v.allowed) continue;
    const raw = scores[v.key] as number | null;
    if (raw == null) continue;
    candidates.push({ variant: v.name, raw, converted: lookup(table, v.name, raw) });
  }

  if (candidates.length === 0) return { variant: "", raw: 0, converted: 0 };
  return candidates.reduce((best, c) => c.converted > best.converted ? c : best);
}

/** 탐구 top-N 선택: 과목 필터(과/사/사과) + 환산점수 내림차순 */
function resolveInquiry(
  scores: SuneungScores,
  config: UniversityScoreConfig,
  table: ConversionTable,
  count: number,
): { subject: string; raw: number; converted: number }[] {
  let allowedSubjects: readonly string[];
  if (config.inquirySelection === "gwa") {
    allowedSubjects = SCIENCE_INQUIRY;
  } else if (config.inquirySelection === "sa") {
    allowedSubjects = SOCIAL_INQUIRY;
  } else {
    allowedSubjects = [...SCIENCE_INQUIRY, ...SOCIAL_INQUIRY];
  }

  const candidates: { subject: string; raw: number; converted: number }[] = [];
  for (const [subject, raw] of Object.entries(scores.inquiry)) {
    if (!allowedSubjects.includes(subject)) continue;
    candidates.push({ subject, raw, converted: lookup(table, subject, raw) });
  }

  // 내림차순 정렬 후 top-N
  candidates.sort((a, b) => b.converted - a.converted);
  return candidates.slice(0, count);
}

/** 모든 과목 해결 — 슬롯별 환산점수 산출 */
export function resolveAllSubjects(
  scores: SuneungScores,
  config: UniversityScoreConfig,
  table: ConversionTable,
): ResolvedScores {
  // 국어
  const koreanConverted = scores.korean != null ? lookup(table, "국어", scores.korean) : 0;

  // 수학 (MAX)
  const mathResult = resolveMath(scores, config, table);

  // 영어 (등급 기반)
  const englishConverted = scores.english != null ? lookup(table, "영어", scores.english) : 0;

  // 한국사 (등급 기반)
  let historyConverted = scores.history != null ? lookup(table, "한국사", scores.history) : 0;

  // 제2외국어 (등급 기반)
  let foreignConverted = scores.foreignLang != null ? lookup(table, "제2외국어", scores.foreignLang) : 0;

  // 탐구 top-N
  const inquiryCount = config.inquiryCount;
  const inquiryResults = resolveInquiry(scores, config, table, Math.max(inquiryCount, 2));
  const inquiry1 = inquiryResults[0]?.converted ?? 0;
  const inquiry2 = inquiryResults[1]?.converted ?? 0;

  // 한국사 → 탐구 대체: 한국사 점수를 탐구 풀에 추가
  if (config.historySubstitute === "to_inquiry" && historyConverted > 0) {
    // 한국사가 탐구보다 높으면 대체
    if (inquiryCount >= 1 && historyConverted > (inquiryResults[inquiryCount - 1]?.converted ?? 0)) {
      // 대체 로직은 mandatory-scorer에서 처리 (한국사를 별도로 합산하지 않음)
    }
  }

  // 한국사 → 영어 대체
  if (config.historySubstitute === "to_english" && historyConverted > englishConverted) {
    // 대체 로직은 mandatory-scorer에서 처리
  }

  // 개별 과목 맵 (선택/가중용)
  const subjectScores: Record<string, number> = {
    "국어": koreanConverted,
    "수학": mathResult.converted,
    "영어": englishConverted,
    "한국사": historyConverted,
    "제2외국어": foreignConverted,
    "탐구1": inquiry1,
    "탐구2": inquiry2,
  };

  // 탐구 합산
  let inquiryTotal = 0;
  for (let i = 0; i < inquiryCount && i < inquiryResults.length; i++) {
    inquiryTotal += inquiryResults[i].converted;
  }

  return {
    korean: koreanConverted,
    math: mathResult.converted,
    english: englishConverted,
    history: historyConverted,
    inquiry: inquiryTotal,
    inquiry1,
    inquiry2,
    foreign: foreignConverted,
    subjectScores,
  };
}

/** 슬롯을 해결된 점수로 변환 */
export function resolveSlotScore(slot: SubjectSlot, resolved: ResolvedScores): number {
  switch (slot.type) {
    case "korean": return resolved.korean;
    case "math": return resolved.math;
    case "english": return resolved.english;
    case "history": return resolved.history;
    case "foreign": return resolved.foreign;
    case "inquiry":
      if (slot.count === 1) return resolved.inquiry1;
      if (slot.count === 2) return resolved.inquiry1 + resolved.inquiry2;
      return resolved.inquiry;
  }
}

/** 슬롯 풀을 개별 점수 배열로 확장 (LARGE 선택용) */
export function expandPoolToScores(pool: SubjectSlot[], resolved: ResolvedScores): number[] {
  const scores: number[] = [];
  for (const slot of pool) {
    switch (slot.type) {
      case "korean": scores.push(resolved.korean); break;
      case "math": scores.push(resolved.math); break;
      case "english": scores.push(resolved.english); break;
      case "history": scores.push(resolved.history); break;
      case "foreign": scores.push(resolved.foreign); break;
      case "inquiry":
        if (slot.count >= 1 && resolved.inquiry1 > 0) scores.push(resolved.inquiry1);
        if (slot.count >= 2 && resolved.inquiry2 > 0) scores.push(resolved.inquiry2);
        break;
    }
  }
  return scores;
}
