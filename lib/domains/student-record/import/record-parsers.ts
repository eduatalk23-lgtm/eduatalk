// ============================================
// 핵심 NEIS 레코드 파서 — 학생정보, 교과학습, 창체, 행특
// ============================================

import type { RecordImportData } from "./types";
import { getSectionLines, type SectionMap } from "./section-mapper";

// ============================================
// 학생 정보
// ============================================

export function parseStudentInfo(
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

export function parseAcademic(
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

export function parseCreativeActivities(
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
// 행동특성 및 종합의견
// ============================================

export function parseBehavior(
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
