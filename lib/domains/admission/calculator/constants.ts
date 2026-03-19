// ============================================
// 정시 환산 엔진 상수
// Phase 8.2 — 과목 ID + 패턴 레지스트리
// ============================================

import type { SubjectSlot, ParsedMandatoryPattern, ParsedOptionalPattern, ParsedWeightedPattern } from "./types";

// ── 과목 분류 ──────────────────────────────

export const SCIENCE_INQUIRY = [
  "물리학Ⅰ", "물리학Ⅱ", "화학Ⅰ", "화학Ⅱ",
  "생명과학Ⅰ", "생명과학Ⅱ", "지구과학Ⅰ", "지구과학Ⅱ",
] as const;

export const SOCIAL_INQUIRY = [
  "생활과윤리", "윤리와사상", "한국지리", "세계지리",
  "동아시아사", "세계사", "경제", "정치와법", "사회·문화",
] as const;

export const ALL_INQUIRY = [...SCIENCE_INQUIRY, ...SOCIAL_INQUIRY] as const;

export const MATH_VARIANTS = ["미적분", "기하", "확률과통계"] as const;

// ── 슬롯 헬퍼 ──────────────────────────────

const korean: SubjectSlot = { type: "korean" };
const math: SubjectSlot = { type: "math" };
const english: SubjectSlot = { type: "english" };
const history: SubjectSlot = { type: "history" };
const foreign_: SubjectSlot = { type: "foreign" };
const inq = (n: number): SubjectSlot => ({ type: "inquiry", count: n });

// ── 필수 패턴 레지스트리 (19개) ─────────────

export const MANDATORY_PATTERNS: Record<string, ParsedMandatoryPattern> = {
  "국수영탐(2)":   { subjects: [korean, math, english, inq(2)] },
  "국수영탐(1)":   { subjects: [korean, math, english, inq(1)] },
  "국수영":        { subjects: [korean, math, english] },
  "국수탐(2)":     { subjects: [korean, math, inq(2)] },
  "국수탐(1)":     { subjects: [korean, math, inq(1)] },
  "국영탐(2)":     { subjects: [korean, english, inq(2)] },
  "국영탐(1)":     { subjects: [korean, english, inq(1)] },
  "수영탐(2)":     { subjects: [math, english, inq(2)] },
  "수영탐(1)":     { subjects: [math, english, inq(1)] },
  "국수":          { subjects: [korean, math] },
  "국영":          { subjects: [korean, english] },
  "수영":          { subjects: [math, english] },
  "영탐(2)":       { subjects: [english, inq(2)] },
  "영탐(1)":       { subjects: [english, inq(1)] },
  "탐(2)":         { subjects: [inq(2)] },
  "탐(1)":         { subjects: [inq(1)] },
  "영":            { subjects: [english] },
  "국":            { subjects: [korean] },
  "수":            { subjects: [math] },
};

// ── 선택 패턴 레지스트리 (27개+) ────────────

export const OPTIONAL_PATTERNS: Record<string, ParsedOptionalPattern> = {
  "국수中택1":              { pool: [korean, math], pickCount: 1 },
  "국수영中택1":            { pool: [korean, math, english], pickCount: 1 },
  "국수영中택2":            { pool: [korean, math, english], pickCount: 2 },
  "국수영탐(1)中택1":       { pool: [korean, math, english, inq(1)], pickCount: 1 },
  "국수영탐(1)中택2":       { pool: [korean, math, english, inq(1)], pickCount: 2 },
  "국수영탐(1)中택3":       { pool: [korean, math, english, inq(1)], pickCount: 3 },
  "국수영탐(2)中택1":       { pool: [korean, math, english, inq(2)], pickCount: 1 },
  "국수영탐(2)中택2":       { pool: [korean, math, english, inq(2)], pickCount: 2 },
  "국수영탐(2)中택3":       { pool: [korean, math, english, inq(2)], pickCount: 3 },
  "국수탐(1)中택1":         { pool: [korean, math, inq(1)], pickCount: 1 },
  "국수탐(1)中택2":         { pool: [korean, math, inq(1)], pickCount: 2 },
  "국수탐(2)中택1":         { pool: [korean, math, inq(2)], pickCount: 1 },
  "국수탐(2)中택2":         { pool: [korean, math, inq(2)], pickCount: 2 },
  "국영탐(1)中택1":         { pool: [korean, english, inq(1)], pickCount: 1 },
  "국영탐(1)中택2":         { pool: [korean, english, inq(1)], pickCount: 2 },
  "수영탐(1)中택1":         { pool: [math, english, inq(1)], pickCount: 1 },
  "수영탐(1)中택2":         { pool: [math, english, inq(1)], pickCount: 2 },
  "탐(2)中택1":             { pool: [inq(2)], pickCount: 1 },
  "국수영한中택1":          { pool: [korean, math, english, history], pickCount: 1 },
  "국수영한中택2":          { pool: [korean, math, english, history], pickCount: 2 },
  "국수영한中택3":          { pool: [korean, math, english, history], pickCount: 3 },
  "국수영탐(1)한中택2":     { pool: [korean, math, english, inq(1), history], pickCount: 2 },
  "국수영탐(1)한中택3":     { pool: [korean, math, english, inq(1), history], pickCount: 3 },
  "국수영탐(2)한中택2":     { pool: [korean, math, english, inq(2), history], pickCount: 2 },
  "국수영탐(2)한中택3":     { pool: [korean, math, english, inq(2), history], pickCount: 3 },
  "국수영외中택2":          { pool: [korean, math, english, foreign_], pickCount: 2 },
  "국수영탐(1)외中택3":     { pool: [korean, math, english, inq(1), foreign_], pickCount: 3 },
};

// ── 가중택 패턴 레지스트리 (17개+) ──────────

export const WEIGHTED_PATTERNS: Record<string, ParsedWeightedPattern> = {
  "국수영탐(2)中가중택4":   { pool: [korean, math, english, inq(2)], pickCount: 4 },
  "국수영탐(2)中가중택3":   { pool: [korean, math, english, inq(2)], pickCount: 3 },
  "국수영탐(1)中가중택4":   { pool: [korean, math, english, inq(1)], pickCount: 4 },
  "국수영탐(1)中가중택3":   { pool: [korean, math, english, inq(1)], pickCount: 3 },
  "국수영中가중택3":        { pool: [korean, math, english], pickCount: 3 },
  "국수영中가중택2":        { pool: [korean, math, english], pickCount: 2 },
  "국수中가중택2":          { pool: [korean, math], pickCount: 2 },
  "탐(2)中가중택2":         { pool: [inq(2)], pickCount: 2 },
  "국수영탐(2)한中가중택5": { pool: [korean, math, english, inq(2), history], pickCount: 5 },
  "국수영탐(1)한中가중택4": { pool: [korean, math, english, inq(1), history], pickCount: 4 },
  "국수탐(2)中가중택3":     { pool: [korean, math, inq(2)], pickCount: 3 },
  "국수탐(2)中가중택4":     { pool: [korean, math, inq(2)], pickCount: 4 },
  "국수탐(1)中가중택3":     { pool: [korean, math, inq(1)], pickCount: 3 },
  "수영탐(1)中가중택3":     { pool: [math, english, inq(1)], pickCount: 3 },
  "수영탐(2)中가중택3":     { pool: [math, english, inq(2)], pickCount: 3 },
  "국영탐(1)中가중택3":     { pool: [korean, english, inq(1)], pickCount: 3 },
  "국영탐(2)中가중택3":     { pool: [korean, english, inq(2)], pickCount: 3 },
};

// ── 슬롯 라벨 (디버깅/표시용) ───────────────

export function slotLabel(slot: SubjectSlot): string {
  switch (slot.type) {
    case "korean": return "국어";
    case "math": return "수학";
    case "english": return "영어";
    case "history": return "한국사";
    case "foreign": return "제2외국어";
    case "inquiry": return `탐구(${slot.count})`;
  }
}
