// ============================================
// pipeline/slots/slot-area-classifier.ts
//
// Step 2.1: 교과명 → SlotArea 분류 (career_subject vs regular_subject).
// 정책:
//   1. cascadePlan.subjects 명시 → career_subject (1순위)
//   2. mainThemeKeywords와 N개 이상 매칭 → career_subject (fallback)
//   3. 그 외 → regular_subject
// ============================================

import { CAREER_SUBJECT_FALLBACK_OVERLAP } from "./slot-config";

function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[\s·,/[\]{}"'`~!@#$%^&*+=|<>?:;.()0-9-]+/)
    .filter((t) => t.length >= 2);
}

function countOverlap(haystack: string, needles: string[]): number {
  if (needles.length === 0) return 0;
  const lower = haystack.toLowerCase();
  let count = 0;
  for (const n of needles) {
    if (n.length < 2) continue;
    if (lower.includes(n.toLowerCase())) count++;
  }
  return count;
}

export interface ClassifySubjectInput {
  subject: string;
  cascadeSubjects: string[];
  mainThemeKeywords: string[];
}

export function classifySubject(input: ClassifySubjectInput): "career_subject" | "regular_subject" {
  const { subject, cascadeSubjects, mainThemeKeywords } = input;

  const cascadeSet = new Set(cascadeSubjects.map((s) => s.trim()));
  if (cascadeSet.has(subject.trim())) return "career_subject";

  const overlap = countOverlap(subject, mainThemeKeywords);
  if (overlap >= CAREER_SUBJECT_FALLBACK_OVERLAP) return "career_subject";

  return "regular_subject";
}

/** 토큰화 — slot intent.focusKeywords 등에서 재사용. */
export function tokenizeForSlot(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(tokenize(text)));
}
