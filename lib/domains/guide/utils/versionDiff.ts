/**
 * M2: 버전 비교 — 결정론적 diff 유틸리티
 *
 * 두 GuideDetail 객체를 비교하여 메타/섹션별 차이를 계산합니다.
 * Layer 1 (결정론적) — AI 호출 없음, 즉시 반환.
 *
 * @module lib/domains/guide/utils/versionDiff
 */

import type {
  GuideDetail,
  GuideStatus,
  GuideType,
  GuideSourceType,
  DifficultyLevel,
  ContentSection,
  TheorySection,
} from "../types";

// ============================================================
// 1. 타입 정의
// ============================================================

/** 필드 변경 기록 (old → new) */
export interface FieldChange<T> {
  old: T;
  new: T;
}

/** 메타 필드 변경 요약 */
export interface MetaDiff {
  title: FieldChange<string> | null;
  status: FieldChange<GuideStatus> | null;
  guideType: FieldChange<GuideType> | null;
  sourceType: FieldChange<GuideSourceType> | null;
  difficultyLevel: FieldChange<DifficultyLevel | null> | null;
  qualityScore: FieldChange<number | null> | null;
  subjectArea: FieldChange<string | null> | null;
  subjectSelect: FieldChange<string | null> | null;
  bookTitle: FieldChange<string | null> | null;
}

/** 텍스트 diff 청크 */
export interface DiffHunk {
  type: "add" | "remove" | "equal";
  text: string;
}

/** 섹션별 diff */
export interface SectionDiff {
  key: string;
  label: string;
  type: "added" | "removed" | "modified" | "unchanged";
  /** 글자수 변화 (+/-) */
  charDelta: number;
  /** 문장 단위 diff (modified인 경우에만) */
  hunks?: DiffHunk[];
}

/** 전체 diff 결과 */
export interface VersionDiff {
  meta: MetaDiff;
  sections: SectionDiff[];
  stats: {
    addedSections: number;
    removedSections: number;
    modifiedSections: number;
    unchangedSections: number;
    totalCharDelta: number;
  };
  /** 두 버전 간 경과 시간 (ms) */
  timeDeltaMs: number;
}

// ============================================================
// 2. 내부 유틸리티
// ============================================================

/** HTML 태그 제거 후 순수 텍스트 추출 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 텍스트를 문장 단위로 분리 */
function splitSentences(text: string): string[] {
  // 마침표, 물음표, 느낌표, 줄바꿈으로 분리 (한국어 고려)
  return text
    .split(/(?<=[.?!。\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 간단한 LCS(Longest Common Subsequence) 기반 diff
 * 문장 배열을 비교하여 DiffHunk[] 반환
 */
export function diffSentences(
  oldSentences: string[],
  newSentences: string[],
): DiffHunk[] {
  const m = oldSentences.length;
  const n = newSentences.length;

  // LCS 테이블 구축
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldSentences[i - 1] === newSentences[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const hunks: DiffHunk[] = [];
  let i = m;
  let j = n;

  // 역순 추적 결과를 임시 저장 후 뒤집기
  const reversedHunks: DiffHunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldSentences[i - 1] === newSentences[j - 1]) {
      reversedHunks.push({ type: "equal", text: oldSentences[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversedHunks.push({ type: "add", text: newSentences[j - 1] });
      j--;
    } else {
      reversedHunks.push({ type: "remove", text: oldSentences[i - 1] });
      i--;
    }
  }

  // 뒤집어서 정방향으로
  for (let k = reversedHunks.length - 1; k >= 0; k--) {
    hunks.push(reversedHunks[k]);
  }

  // 인접한 같은 타입의 hunks 병합
  return mergeAdjacentHunks(hunks);
}

/** 인접한 같은 타입 hunks를 병합 */
function mergeAdjacentHunks(hunks: DiffHunk[]): DiffHunk[] {
  if (hunks.length === 0) return [];

  const merged: DiffHunk[] = [{ ...hunks[0] }];

  for (let i = 1; i < hunks.length; i++) {
    const last = merged[merged.length - 1];
    if (last.type === hunks[i].type) {
      last.text += " " + hunks[i].text;
    } else {
      merged.push({ ...hunks[i] });
    }
  }

  return merged;
}

/** 필드 변경 감지 (값이 다르면 FieldChange 반환, 같으면 null) */
function detectChange<T>(oldVal: T, newVal: T): FieldChange<T> | null {
  if (oldVal === newVal) return null;
  // null/undefined 동일 취급
  if (oldVal == null && newVal == null) return null;
  return { old: oldVal, new: newVal };
}

// ============================================================
// 3. 섹션 정규화
// ============================================================

interface NormalizedSection {
  key: string;
  label: string;
  text: string; // HTML 제거된 순수 텍스트
  rawContent: string; // 원본 콘텐츠
}

/** GuideDetail의 content에서 비교 가능한 섹션 목록 추출 */
function extractSections(guide: GuideDetail): NormalizedSection[] {
  const sections: NormalizedSection[] = [];

  if (!guide.content) return sections;

  const c = guide.content;

  // 레거시 필드 → 섹션화
  if (c.motivation) {
    sections.push({
      key: "motivation",
      label: "탐구 동기",
      text: stripHtml(c.motivation),
      rawContent: c.motivation,
    });
  }

  // theory_sections
  if (c.theory_sections?.length) {
    for (const ts of c.theory_sections) {
      sections.push({
        key: `theory_${ts.order}`,
        label: ts.title || `탐구 이론 ${ts.order}`,
        text: stripHtml(ts.content),
        rawContent: ts.content,
      });
    }
  }

  if (c.reflection) {
    sections.push({
      key: "reflection",
      label: "탐구 고찰",
      text: stripHtml(c.reflection),
      rawContent: c.reflection,
    });
  }

  if (c.impression) {
    sections.push({
      key: "impression",
      label: "느낀점",
      text: stripHtml(c.impression),
      rawContent: c.impression,
    });
  }

  if (c.summary) {
    sections.push({
      key: "summary",
      label: "탐구 요약",
      text: stripHtml(c.summary),
      rawContent: c.summary,
    });
  }

  if (c.follow_up) {
    sections.push({
      key: "follow_up",
      label: "후속 탐구",
      text: stripHtml(c.follow_up),
      rawContent: c.follow_up,
    });
  }

  if (c.book_description) {
    sections.push({
      key: "book_description",
      label: "도서 소개",
      text: stripHtml(c.book_description),
      rawContent: c.book_description,
    });
  }

  // content_sections (유형별 섹션)
  if (c.content_sections?.length) {
    for (const cs of c.content_sections) {
      sections.push({
        key: cs.key,
        label: cs.label,
        text: stripHtml(cs.content),
        rawContent: cs.content,
      });
    }
  }

  return sections;
}

// ============================================================
// 4. 메인 diff 함수
// ============================================================

/**
 * 두 가이드 버전을 비교하여 VersionDiff를 반환합니다.
 *
 * @param older 이전 버전 (v-1)
 * @param newer 최신 버전 (v)
 * @returns VersionDiff 결과 (동기 함수, 즉시 반환)
 */
export function compareVersions(
  older: GuideDetail,
  newer: GuideDetail,
): VersionDiff {
  // --- 메타 diff ---
  const meta: MetaDiff = {
    title: detectChange(older.title, newer.title),
    status: detectChange(older.status, newer.status),
    guideType: detectChange(older.guide_type, newer.guide_type),
    sourceType: detectChange(older.source_type, newer.source_type),
    difficultyLevel: detectChange(
      older.difficulty_level,
      newer.difficulty_level,
    ),
    qualityScore: detectChange(older.quality_score, newer.quality_score),
    subjectArea: detectChange(older.subject_area, newer.subject_area),
    subjectSelect: detectChange(older.subject_select, newer.subject_select),
    bookTitle: detectChange(older.book_title, newer.book_title),
  };

  // --- 섹션 diff ---
  const oldSections = extractSections(older);
  const newSections = extractSections(newer);

  const oldMap = new Map(oldSections.map((s) => [s.key, s]));
  const newMap = new Map(newSections.map((s) => [s.key, s]));

  const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const sectionDiffs: SectionDiff[] = [];

  let addedSections = 0;
  let removedSections = 0;
  let modifiedSections = 0;
  let unchangedSections = 0;
  let totalCharDelta = 0;

  for (const key of allKeys) {
    const oldSec = oldMap.get(key);
    const newSec = newMap.get(key);

    if (!oldSec && newSec) {
      // 추가
      const charDelta = newSec.text.length;
      addedSections++;
      totalCharDelta += charDelta;
      sectionDiffs.push({
        key,
        label: newSec.label,
        type: "added",
        charDelta,
      });
    } else if (oldSec && !newSec) {
      // 삭제
      const charDelta = -oldSec.text.length;
      removedSections++;
      totalCharDelta += charDelta;
      sectionDiffs.push({
        key,
        label: oldSec.label,
        type: "removed",
        charDelta,
      });
    } else if (oldSec && newSec) {
      if (oldSec.text === newSec.text) {
        // 변경 없음
        unchangedSections++;
        sectionDiffs.push({
          key,
          label: newSec.label,
          type: "unchanged",
          charDelta: 0,
        });
      } else {
        // 수정
        const charDelta = newSec.text.length - oldSec.text.length;
        modifiedSections++;
        totalCharDelta += charDelta;

        const oldSentences = splitSentences(oldSec.text);
        const newSentences = splitSentences(newSec.text);
        const hunks = diffSentences(oldSentences, newSentences);

        sectionDiffs.push({
          key,
          label: newSec.label,
          type: "modified",
          charDelta,
          hunks,
        });
      }
    }
  }

  // 섹션 순서: 원본(newer)의 순서 유지, 삭제된 것은 끝에
  const newKeyOrder = newSections.map((s) => s.key);
  sectionDiffs.sort((a, b) => {
    const aIdx = newKeyOrder.indexOf(a.key);
    const bIdx = newKeyOrder.indexOf(b.key);
    // 삭제된 섹션은 원래 없으므로 끝으로
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  // --- 시간 차이 ---
  const olderTime = new Date(older.created_at).getTime();
  const newerTime = new Date(newer.created_at).getTime();
  const timeDeltaMs = Math.abs(newerTime - olderTime);

  return {
    meta,
    sections: sectionDiffs,
    stats: {
      addedSections,
      removedSections,
      modifiedSections,
      unchangedSections,
      totalCharDelta,
    },
    timeDeltaMs,
  };
}

/**
 * MetaDiff에서 실제 변경된 필드만 추출합니다.
 * UI에서 "메타 변경 N건" 표시에 사용.
 */
export function countMetaChanges(meta: MetaDiff): number {
  let count = 0;
  if (meta.title) count++;
  if (meta.status) count++;
  if (meta.guideType) count++;
  if (meta.sourceType) count++;
  if (meta.difficultyLevel) count++;
  if (meta.qualityScore) count++;
  if (meta.subjectArea) count++;
  if (meta.subjectSelect) count++;
  if (meta.bookTitle) count++;
  return count;
}
