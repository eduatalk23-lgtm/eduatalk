// ============================================
// NEIS HTML 직접 파서 — AI 없이 즉시 파싱
// Python neis_to_docx.py 로직을 TypeScript로 포팅
// 클라이언트(브라우저) 전용
// ============================================

import type { RecordImportData } from "./types";

// ============================================
// DOM → 줄 단위 텍스트 추출 (Python HTMLParser 방식)
// ============================================

/** 블록 요소 태그 — 이 태그 앞뒤에서 줄바꿈 삽입 */
const BLOCK_TAGS = new Set([
  "div", "p", "tr", "td", "th", "li", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "section", "article", "header", "footer", "nav",
  "table", "thead", "tbody", "tfoot",
  "ul", "ol", "dl", "dt", "dd",
  "blockquote", "pre", "address",
]);

function extractTextFromDom(element: Element | null): string {
  if (!element) return "";
  const parts: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // 블록 요소 시작 시 줄바꿈
    if (BLOCK_TAGS.has(tag)) {
      parts.push("\n");
    }

    for (const child of node.childNodes) {
      walk(child);
    }

    // 블록 요소 종료 시 줄바꿈
    if (BLOCK_TAGS.has(tag)) {
      parts.push("\n");
    }
  }

  walk(element);

  // 줄 단위 정리
  return parts
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

// ============================================
// 메인 파싱 함수
// ============================================

/** NEIS 학부모서비스 HTML을 직접 파싱하여 RecordImportData 반환 */
export function parseNeisHtml(htmlContent: string): RecordImportData {
  // 1. HTML → 줄 단위 텍스트 추출 (Python HTMLParser 방식)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  const fullText = extractTextFromDom(doc.body);

  // 2. 생활기록부 영역 추출
  const recordText = extractSchoolRecord(fullText);

  // 3. 줄 단위 파싱
  const lines = recordText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 4. 섹션 범위 찾기
  const sections = findSectionRanges(lines);

  // 5. 각 섹션별 데이터 추출
  const studentInfo = parseStudentInfo(lines, sections);
  const { seteks, grades } = parseAcademic(lines, sections);
  const creativeActivities = parseCreativeActivities(lines, sections);
  const attendance = parseAttendance(lines, sections);
  const readingActivities = parseReading(lines, sections);
  const behavioralCharacteristics = parseBehavior(lines, sections);

  const awards = parseAwards(lines, sections);
  const volunteerActivities = parseVolunteer(lines, sections);
  const classInfo = parseClassInfo(lines, sections);

  return {
    studentInfo,
    detailedCompetencies: seteks,
    creativeActivities,
    behavioralCharacteristics,
    grades,
    attendance,
    readingActivities,
    awards,
    volunteerActivities,
    classInfo,
  };
}

// ============================================
// 생활기록부 영역 추출
// ============================================

function extractSchoolRecord(fullText: string): string {
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

interface SectionMap {
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

function findSectionRanges(lines: string[]): SectionMap {
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

function getSectionLines(
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

// ============================================
// 학생 정보
// ============================================

function parseStudentInfo(
  lines: string[],
  sections: SectionMap,
): RecordImportData["studentInfo"] {
  const personalLines = getSectionLines(lines, sections, "1. 인적·학적사항");

  let name = "";
  let schoolName = "";
  let schoolYear = 0;

  for (let i = 0; i < personalLines.length; i++) {
    if (personalLines[i] === "성명" && i + 1 < personalLines.length) {
      name = personalLines[i + 1];
    }
  }

  // 학반정보에서 학교명 추출 시도
  const banLines = getSectionLines(lines, sections, "학반정보");
  // 학적사항에서 입학 연도 추정
  // NEIS 형식: "2024년 03월 01일  학교명  제1학년 입학" 또는 "2024.03.01  학교명  입학"
  for (const line of personalLines) {
    const match = line.match(/(\d{4})[년.\s]\s*\d+[월.\s].*입학/);
    if (match) {
      schoolYear = parseInt(match[1], 10);
      // 입학 줄에서 학교명 추출
      const schoolMatch = line.match(/\s{2,}(.+?(?:학교|고등|여고|중학))\s/);
      if (schoolMatch && !schoolName) {
        schoolName = schoolMatch[1].trim();
      }
    }
    if (!schoolName && line.includes("학교") && !line.includes("학교폭력") && !line.includes("입학") && !line.includes("졸업")) {
      schoolName = line;
    }
  }

  // 학교명을 학반정보에서도 탐색
  if (!schoolName) {
    for (const line of banLines) {
      if (line.includes("학교") || line.includes("고등") || line.includes("여고") || line.includes("중학")) {
        schoolName = line;
        break;
      }
    }
  }

  return { name, schoolName, schoolYear };
}

// ============================================
// 교과학습발달상황 (성적 + 세특)
// ============================================

function parseAcademic(
  lines: string[],
  sections: SectionMap,
): {
  seteks: RecordImportData["detailedCompetencies"];
  grades: RecordImportData["grades"];
} {
  const academicLines = getSectionLines(lines, sections, "7. 교과학습발달상황");
  const seteks: RecordImportData["detailedCompetencies"] = [];
  const grades: RecordImportData["grades"] = [];

  let currentGrade = "";
  let currentSemester = 1;
  let inSetek = false;
  // 테이블 모드: "general" | "elective" | "pe_art"
  let tableMode: "general" | "elective" | "pe_art" = "general";
  let i = 0;

  const subjectCategories = [
    "국어", "수학", "영어", "한국사", "사회(역사/도덕포함)", "사회",
    "과학", "체육", "예술", "기술・가정/제2외국어/한문/교양",
    "기술·가정/제2외국어/한문/교양", "교양",
  ];

  /** 테이블 헤더 키워드 */
  const TABLE_HEADERS = new Set([
    "학기", "교과", "과목", "학점수", "원점수/과목평균(표준편차)",
    "성취도(수강자수)", "석차등급", "비고", "원점수/과목평균",
    "성취도별 분포비율", "성취도", "공동",
  ]);

  while (i < academicLines.length) {
    const line = academicLines[i];

    // ── 학년 감지 ──
    const gradeMatch = line.match(/^(\d)학년$/);
    if (gradeMatch) {
      currentGrade = `${gradeMatch[1]}학년`;
      currentSemester = 1;
      inSetek = false;
      tableMode = "general";
      i++;
      continue;
    }

    // ── 서브섹션 헤더 감지 (테이블 모드 전환) ──
    if (line.includes("진로 선택 과목") || line.includes("진로선택과목")) {
      tableMode = "elective";
      inSetek = false;
      i++;
      continue;
    }
    if (line.includes("체육") && line.includes("예술") && line.startsWith("<")) {
      tableMode = "pe_art";
      inSetek = false;
      i++;
      continue;
    }

    // ── 세특 시작 ──
    if (line === "세부능력 및 특기사항") {
      inSetek = true;
      i++;
      continue;
    }

    // ── 성적 테이블 헤더 스킵 ──
    if (TABLE_HEADERS.has(line) && !inSetek) {
      i++;
      continue;
    }

    // ── 이수학점 합계 스킵 ──
    if (line.startsWith("이수학점")) {
      i++;
      if (i < academicLines.length && /^\d+$/.test(academicLines[i])) i++;
      continue;
    }

    // ── 당해학년도 스킵 ──
    if (line.includes("당해학년도")) {
      i++;
      continue;
    }

    // ── 세특 파싱 ──
    if (inSetek && currentGrade) {
      if (line.startsWith("<") && line.endsWith(">")) { i++; continue; }
      if (line.startsWith("이수학점")) { i++; continue; }
      if (/^\d학년$/.test(line)) { continue; } // 외부 루프에서 처리

      const colonMatch = line.match(/^(.+?):\s+(.+)/);
      if (colonMatch) {
        const rawSubject = colonMatch[1].trim();
        const content = colonMatch[2].trim();

        let semester = "1학기";
        const semMatch = rawSubject.match(/^\((\d)학기\)/);
        if (semMatch) semester = `${semMatch[1]}학기`;

        let subjectName = rawSubject.replace(/^\(\d학기\)/, "").trim();
        if (subjectName.includes("·")) subjectName = subjectName.split("·")[0].trim();

        seteks.push({ grade: currentGrade, semester, subject: subjectName, content });
      }
      i++;
      continue;
    }

    // ── 성적 데이터 파싱 ──
    if (!inSetek && currentGrade) {
      // 학기 번호 감지
      if (
        (line === "1" || line === "2") &&
        i + 1 < academicLines.length &&
        subjectCategories.includes(academicLines[i + 1])
      ) {
        currentSemester = parseInt(line, 10);
        i++;
        continue;
      }

      if (subjectCategories.includes(line)) {
        const subjectCategory = line;
        i++;
        if (i >= academicLines.length) break;
        const subjectName = academicLines[i];
        i++;

        let creditHours = 0;
        if (i < academicLines.length && /^\d+$/.test(academicLines[i])) {
          creditHours = parseInt(academicLines[i], 10);
          i++;
        }

        // ── P(pass/fail) 평가 ──
        if (i < academicLines.length && academicLines[i] === "P") {
          i++;
          if (i < academicLines.length && academicLines[i] === "P") i++;
          grades.push({
            grade: currentGrade, semester: `${currentSemester}학기`,
            subject: subjectName, subjectType: subjectCategory, creditHours,
            rawScore: 0, classAverage: 0, standardDeviation: 0,
            achievementLevel: "P", totalStudents: 0, rankGrade: 0,
          });
          continue;
        }

        // ── 체육·예술: 성취도(A/B/C)만 ──
        if (tableMode === "pe_art") {
          let achievementLevel = "";
          if (i < academicLines.length && /^[A-C]$/.test(academicLines[i])) {
            achievementLevel = academicLines[i];
            i++;
          }
          grades.push({
            grade: currentGrade, semester: `${currentSemester}학기`,
            subject: subjectName, subjectType: subjectCategory, creditHours,
            rawScore: 0, classAverage: 0, standardDeviation: 0,
            achievementLevel, totalStudents: 0, rankGrade: 0,
          });
          continue;
        }

        // ── 진로선택: 원점수/평균 (표준편차 없음) + 성취도(수강자수) + 분포비율 ──
        if (tableMode === "elective") {
          let rawScore = 0, classAverage = 0;
          if (i < academicLines.length) {
            // "91/90.1" 또는 "91/90.1(12.3)" 형식 모두 지원
            const m = academicLines[i].match(/([\d.]+)\s*\/\s*([\d.]+)/);
            if (m) { rawScore = parseFloat(m[1]); classAverage = parseFloat(m[2]); }
            i++;
          }
          let achievementLevel = "", totalStudents = 0;
          if (i < academicLines.length) {
            const am = academicLines[i].match(/([A-E])\((\d+)\)/);
            if (am) { achievementLevel = am[1]; totalStudents = parseInt(am[2], 10); }
            i++;
          }
          // 성취도별 분포비율: "A(85.2) B(14.8) C(0.0)" 패턴
          let ratioA: number | undefined, ratioB: number | undefined, ratioC: number | undefined;
          let ratioD: number | undefined, ratioE: number | undefined;
          if (i < academicLines.length && /^[A-E]\([\d.]+\)/.test(academicLines[i])) {
            const ratioLine = academicLines[i];
            const ratioMatches = [...ratioLine.matchAll(/([A-E])\(([\d.]+)\)/g)];
            for (const rm of ratioMatches) {
              const val = parseFloat(rm[2]);
              if (rm[1] === "A") ratioA = val;
              else if (rm[1] === "B") ratioB = val;
              else if (rm[1] === "C") ratioC = val;
              else if (rm[1] === "D") ratioD = val;
              else if (rm[1] === "E") ratioE = val;
            }
            i++;
          }
          // "공동" 비고 스킵
          if (i < academicLines.length && academicLines[i] === "공동") i++;

          grades.push({
            grade: currentGrade, semester: `${currentSemester}학기`,
            subject: subjectName, subjectType: subjectCategory, creditHours,
            rawScore, classAverage, standardDeviation: 0,
            achievementLevel, totalStudents, rankGrade: 0,
            achievementRatioA: ratioA, achievementRatioB: ratioB, achievementRatioC: ratioC,
            achievementRatioD: ratioD, achievementRatioE: ratioE,
          });
          continue;
        }

        // ── 일반과목: 원점수/평균(표준편차) + 성취도(수강자수) + 석차등급 ──
        let rawScore = 0, classAverage = 0, standardDeviation = 0;
        if (i < academicLines.length) {
          const sm = academicLines[i].match(/([\d.]+)\s*\/\s*([\d.]+)\s*\(([\d.]+)\)/);
          if (sm) {
            rawScore = parseFloat(sm[1]);
            classAverage = parseFloat(sm[2]);
            standardDeviation = parseFloat(sm[3]);
          }
          i++;
        }
        let achievementLevel = "", totalStudents = 0;
        if (i < academicLines.length) {
          const am = academicLines[i].match(/([A-E])\((\d+)\)/);
          if (am) { achievementLevel = am[1]; totalStudents = parseInt(am[2], 10); }
          i++;
        }
        let rankGrade = 0;
        if (
          i < academicLines.length &&
          /^\d+$/.test(academicLines[i]) &&
          !((academicLines[i] === "1" || academicLines[i] === "2") &&
            i + 1 < academicLines.length && subjectCategories.includes(academicLines[i + 1]))
        ) {
          rankGrade = parseInt(academicLines[i], 10);
          i++;
        }

        grades.push({
          grade: currentGrade, semester: `${currentSemester}학기`,
          subject: subjectName, subjectType: subjectCategory, creditHours,
          rawScore, classAverage, standardDeviation,
          achievementLevel, totalStudents, rankGrade,
        });
        continue;
      }
    }

    i++;
  }

  return { seteks, grades };
}

// ============================================
// 창의적 체험활동상황
// ============================================

function parseCreativeActivities(
  lines: string[],
  sections: SectionMap,
): RecordImportData["creativeActivities"] {
  const secLines = getSectionLines(lines, sections, "6. 창의적 체험활동상황");
  const activities: RecordImportData["creativeActivities"] = [];
  const activityTypes = new Set(["자율활동", "동아리활동", "진로활동"]);

  let currentGrade = "";
  let i = 0;

  while (i < secLines.length) {
    const line = secLines[i];

    // 학년 감지: "1" 다음이 활동유형
    if (
      ["1", "2", "3"].includes(line) &&
      i + 1 < secLines.length &&
      activityTypes.has(secLines[i + 1])
    ) {
      currentGrade = `${line}학년`;
      i++;
      continue;
    }

    // 활동유형 감지
    if (activityTypes.has(line) && currentGrade) {
      const category = line;
      i++;

      // 시간 수집
      let hours = 0;
      if (i < secLines.length && /^\d+$/.test(secLines[i])) {
        hours = parseInt(secLines[i], 10);
        i++;
      }

      // 내용 수집
      const contentParts: string[] = [];
      while (i < secLines.length) {
        const next = secLines[i];
        if (activityTypes.has(next)) break;
        if (["1", "2", "3"].includes(next) && i + 1 < secLines.length && activityTypes.has(secLines[i + 1])) break;
        if (next.startsWith("< 봉사활동실적")) break;
        if (/^7\.\s*교과학습/.test(next)) break;

        // "희망분야" 포함
        contentParts.push(next);
        i++;
      }

      if (contentParts.length > 0) {
        activities.push({
          grade: currentGrade,
          category,
          hours,
          content: contentParts.join(" "),
        });
      }
      continue;
    }

    // 봉사활동실적 이후 스킵
    if (line.includes("봉사활동실적")) {
      break;
    }

    i++;
  }

  return activities;
}

// ============================================
// 출결상황
// ============================================

function parseAttendance(
  lines: string[],
  sections: SectionMap,
): RecordImportData["attendance"] {
  const secLines = getSectionLines(lines, sections, "2. 출결상황");
  const results: RecordImportData["attendance"] = [];

  const skipWords = new Set([
    "학년", "수업일수", "결석일수", "지 각", "조 퇴", "결 과",
    "특기사항", "질병", "미인정", "기타", "지각", "조퇴", "결과",
  ]);

  const dataVals: string[] = [];
  for (const line of secLines) {
    if (!skipWords.has(line)) {
      dataVals.push(line);
    }
  }

  let idx = 0;
  while (idx < dataVals.length) {
    const val = dataVals[idx];
    if (["1", "2", "3"].includes(val) && idx + 1 < dataVals.length) {
      const grade = `${val}학년`;
      idx++;

      // 수업일수 스킵
      if (idx < dataVals.length && /^\d+$/.test(dataVals[idx])) idx++;

      // 결석 3 + 지각 3 + 조퇴 3 + 결과 3 = 12개 값
      const nums: number[] = [];
      let count = 0;
      while (idx < dataVals.length && count < 12) {
        if (dataVals[idx] === "." || /^\d+$/.test(dataVals[idx])) {
          nums.push(dataVals[idx] === "." ? 0 : parseInt(dataVals[idx], 10));
          count++;
          idx++;
        } else {
          break;
        }
      }

      // 특기사항 스킵
      if (idx < dataVals.length && !["1", "2", "3"].includes(dataVals[idx])) {
        idx++;
      }

      results.push({
        grade,
        sickAbsence: nums[0] ?? 0,
        unauthorizedAbsence: nums[1] ?? 0,
        authorizedAbsence: nums[2] ?? 0,
        lateness: (nums[3] ?? 0) + (nums[4] ?? 0) + (nums[5] ?? 0),
        earlyLeave: (nums[6] ?? 0) + (nums[7] ?? 0) + (nums[8] ?? 0),
        classAbsence: (nums[9] ?? 0) + (nums[10] ?? 0) + (nums[11] ?? 0),
      });
    } else {
      idx++;
    }
  }

  return results;
}

// ============================================
// 독서활동상황
// ============================================

function parseReading(
  lines: string[],
  sections: SectionMap,
): RecordImportData["readingActivities"] {
  const secLines = getSectionLines(lines, sections, "8. 독서활동상황");
  const results: RecordImportData["readingActivities"] = [];

  let currentGrade = "";

  for (let i = 0; i < secLines.length; i++) {
    const line = secLines[i];

    // "당해학년도" 스킵
    if (line.includes("당해학년도")) continue;
    // "학년", "독서 활동 상황" 헤더 스킵
    if (line === "학년" || line === "독서 활동 상황" || line === "독서활동상황") continue;

    // 학년 감지
    if (["1", "2", "3"].includes(line)) {
      currentGrade = `${line}학년`;
      continue;
    }

    // 독서 내용: 제목(저자) 패턴 또는 제목만
    if (currentGrade && line.length > 1) {
      // "제목(저자), 제목(저자)" 형식 파싱
      const books = line.split(/,\s*/);
      for (const book of books) {
        const bookMatch = book.trim().match(/^(.+?)\(([^)]+)\)$/);
        if (bookMatch) {
          results.push({
            grade: currentGrade,
            subjectArea: "공통",
            bookTitle: bookMatch[1].trim(),
            author: bookMatch[2].trim(),
          });
        } else if (book.trim().length > 1) {
          results.push({
            grade: currentGrade,
            subjectArea: "공통",
            bookTitle: book.trim(),
            author: "",
          });
        }
      }
    }
  }

  return results;
}

// ============================================
// 행동특성 및 종합의견
// ============================================

function parseBehavior(
  lines: string[],
  sections: SectionMap,
): RecordImportData["behavioralCharacteristics"] {
  const secLines = getSectionLines(lines, sections, "9. 행동특성 및 종합의견");
  const results: RecordImportData["behavioralCharacteristics"] = [];

  let currentGrade = "";

  for (let i = 0; i < secLines.length; i++) {
    const line = secLines[i];

    // 헤더 스킵
    if (line === "학년" || line === "행동특성 및 종합의견") continue;
    if (line.includes("당해학년도")) continue;

    // 학년 감지
    if (["1", "2", "3"].includes(line)) {
      currentGrade = `${line}학년`;
      continue;
    }

    // 실제 내용 (20자 이상)
    if (currentGrade && line.length > 20) {
      results.push({
        grade: currentGrade,
        content: line,
      });
    }
  }

  return results;
}

// ============================================
// 수상경력
// ============================================

function parseAwards(
  lines: string[],
  sections: SectionMap,
): RecordImportData["awards"] {
  const secLines = getSectionLines(lines, sections, "3. 수상경력");
  const results: RecordImportData["awards"] = [];

  const skipWords = new Set([
    "학년", "학기", "수 상 명", "수상명", "등급(위)", "수상연월일",
    "수여기관", "참가대상(참가인원)", "참가대상",
  ]);

  const dataVals: string[] = [];
  for (const line of secLines) {
    if (skipWords.has(line)) continue;
    if (line.includes("당해학년도")) continue;
    dataVals.push(line);
  }

  let i = 0;
  let currentGrade = "";
  let currentSemester = "";

  while (i < dataVals.length) {
    const val = dataVals[i];

    // 학년+학기 감지: "1" 다음 "1" or "2"
    if (["1", "2", "3"].includes(val)) {
      const next = dataVals[i + 1] ?? "";
      if (["1", "2"].includes(next) && i + 2 < dataVals.length && !/^\d{4}[.년]/.test(next)) {
        currentGrade = `${val}학년`;
        currentSemester = `${next}학기`;
        i += 2;
        continue;
      }
      // 같은 학년 내 학기 변경 (예: "2" 다음이 수상명)
      if (currentGrade && val !== currentGrade[0]) {
        currentSemester = `${val}학기`;
        i++;
        continue;
      }
      currentGrade = `${val}학년`;
      i++;
      continue;
    }

    // 수상명: 날짜가 아닌 텍스트
    if (currentGrade && val.length > 2 && !/^\d{4}[.년]/.test(val)) {
      const awardName = val;
      i++;

      let awardDate = "";
      let awardOrg = "";
      let participants = "";

      // 날짜 찾기
      while (i < dataVals.length) {
        if (/^\d{4}[.년]/.test(dataVals[i])) {
          awardDate = dataVals[i];
          i++;
          break;
        }
        i++;
      }

      // 수여기관
      if (i < dataVals.length && !["1", "2", "3"].includes(dataVals[i]) && !/^\d{4}[.년]/.test(dataVals[i])) {
        awardOrg = dataVals[i];
        i++;
      }

      // 참가대상
      if (i < dataVals.length && !["1", "2", "3"].includes(dataVals[i]) && !/^\d{4}[.년]/.test(dataVals[i])) {
        participants = dataVals[i];
        i++;
      }

      results.push({ grade: currentGrade, semester: currentSemester, awardName, awardDate, awardOrg, participants });
      continue;
    }

    i++;
  }

  return results;
}

// ============================================
// 봉사활동실적 (창체 섹션 6 하위)
// ============================================

function parseVolunteer(
  lines: string[],
  sections: SectionMap,
): RecordImportData["volunteerActivities"] {
  const secLines = getSectionLines(lines, sections, "6. 창의적 체험활동상황");
  const results: RecordImportData["volunteerActivities"] = [];

  const startIdx = secLines.findIndex((l) => l.includes("봉사활동실적"));
  if (startIdx === -1) return results;

  const skipWords = new Set([
    "< 봉사활동실적 >", "학년", "일자 또는 기간", "장소 또는 주관기관명",
    "활동내용", "시간", "누계시간",
  ]);

  const dataVals: string[] = [];
  for (const line of secLines.slice(startIdx)) {
    if (skipWords.has(line)) continue;
    if (line.includes("당해학년도")) continue;
    dataVals.push(line);
  }

  let i = 0;
  let currentGrade = "";

  while (i < dataVals.length) {
    const val = dataVals[i];

    // 학년: 다음이 날짜 패턴
    if (["1", "2", "3"].includes(val) && i + 1 < dataVals.length && /^\d{4}[.년]/.test(dataVals[i + 1])) {
      currentGrade = `${val}학년`;
      i++;
      continue;
    }

    // 날짜 패턴 → 봉사 행 시작
    if (currentGrade && /^\d{4}[.년]/.test(val)) {
      const activityDate = val;
      i++;

      let location = "";
      if (i < dataVals.length && !/^\d+$/.test(dataVals[i])) {
        location = dataVals[i];
        i++;
      }

      let content = "";
      if (i < dataVals.length && !/^\d+$/.test(dataVals[i])) {
        content = dataVals[i];
        i++;
      }

      let hours = 0;
      if (i < dataVals.length && /^\d+$/.test(dataVals[i])) {
        hours = parseInt(dataVals[i], 10);
        i++;
      }

      let cumulativeHours = 0;
      if (i < dataVals.length && /^\d+$/.test(dataVals[i])) {
        cumulativeHours = parseInt(dataVals[i], 10);
        i++;
      }

      results.push({ grade: currentGrade, activityDate, location, content, hours, cumulativeHours });
      continue;
    }

    i++;
  }

  return results;
}

// ============================================
// 학반정보 (반/번호/담임)
// ============================================

function parseClassInfo(
  lines: string[],
  sections: SectionMap,
): RecordImportData["classInfo"] {
  const secLines = getSectionLines(lines, sections, "학반정보");
  const results: RecordImportData["classInfo"] = [];

  const skipWords = new Set(["학년", "학과", "반", "번호", "담임성명"]);
  const dataVals: string[] = [];
  for (const line of secLines) {
    if (skipWords.has(line)) continue;
    dataVals.push(line);
  }

  // 학년(1,2,3) → 나머지 값 수집 (다음 학년까지)
  let i = 0;
  while (i < dataVals.length) {
    if (["1", "2", "3"].includes(dataVals[i])) {
      const grade = `${dataVals[i]}학년`;
      i++;

      const vals: string[] = [];
      while (i < dataVals.length && !(["1", "2", "3"].includes(dataVals[i]) && vals.length >= 3)) {
        vals.push(dataVals[i]);
        i++;
      }

      // 4개: 학과, 반, 번호, 담임 / 3개: 반, 번호, 담임
      if (vals.length >= 4) {
        results.push({ grade, className: vals[1], studentNumber: vals[2], homeroomTeacher: vals[3] });
      } else if (vals.length >= 3) {
        results.push({ grade, className: vals[0], studentNumber: vals[1], homeroomTeacher: vals[2] });
      }
    } else {
      i++;
    }
  }

  return results;
}
