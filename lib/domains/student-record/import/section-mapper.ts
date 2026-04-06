// ============================================
// NEIS 섹션 범위 탐지 및 생활기록부 영역 추출
// ============================================

// ============================================
// 생활기록부 영역 추출
// ============================================

export function extractSchoolRecord(fullText: string): string {
  const startMarkers = ["학반정보", "1. 인적·학적사항", "1. 인적ㆍ학적사항"];
  let startIdx = fullText.length;
  for (const marker of startMarkers) {
    const idx = fullText.indexOf(marker);
    if (idx !== -1 && idx < startIdx) startIdx = idx;
  }
  if (startIdx === fullText.length) startIdx = 0;

  const endMarkers = ["개인정보처리방침", "개인 정보 처리 방침", "COPYRIGHT"];
  let endIdx = fullText.length;
  for (const marker of endMarkers) {
    const idx = fullText.indexOf(marker, startIdx);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }

  return fullText.slice(startIdx, endIdx).trim();
}

// ============================================
// 섹션 범위 찾기
// ============================================

export interface SectionMap {
  [key: string]: number;
}

const SECTION_PATTERNS: [string, RegExp][] = [
  ["학반정보", /^학반정보/],
  ["1. 인적·학적사항", /^1\.\s*인적/],
  ["2. 출결상황", /^2\.\s*출결/],
  ["3. 수상경력", /^3\.\s*수상/],
  ["4. 자격증", /^4\.\s*자격증/],
  ["5. 학교폭력", /^5\.\s*학교폭력/],
  ["6. 창의적 체험활동상황", /^6\.\s*창의적/],
  ["7. 교과학습발달상황", /^7\.\s*교과학습/],
  ["8. 독서활동상황", /^8\.\s*독서\s*활?\s*동/],
  ["9. 행동특성 및 종합의견", /^9\.\s*행동특성/],
];

const SECTION_ORDER = SECTION_PATTERNS.map(([name]) => name);

export function findSectionRanges(lines: string[]): SectionMap {
  const found: SectionMap = {};
  for (let i = 0; i < lines.length; i++) {
    for (const [name, pattern] of SECTION_PATTERNS) {
      if (pattern.test(lines[i])) {
        found[name] = i;
      }
    }
  }
  return found;
}

export function getSectionLines(
  lines: string[],
  sections: SectionMap,
  sectionName: string,
): string[] {
  if (!(sectionName in sections)) return [];
  const start = sections[sectionName] + 1;

  // 다음 섹션 찾기
  const idx = SECTION_ORDER.indexOf(sectionName);
  let end = lines.length;
  for (let i = idx + 1; i < SECTION_ORDER.length; i++) {
    if (SECTION_ORDER[i] in sections) {
      end = sections[SECTION_ORDER[i]];
      break;
    }
  }

  return lines.slice(start, end);
}
