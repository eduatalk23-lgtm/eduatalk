// ============================================
// 보조 NEIS 레코드 파서 — 출결, 독서, 수상, 봉사, 학반정보
// ============================================

import type { RecordImportData } from "./types";
import { getSectionLines, type SectionMap } from "./section-mapper";

// ============================================
// 출결상황
// ============================================

export function parseAttendance(
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

export function parseReading(
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
// 수상경력
// ============================================

export function parseAwards(
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

export function parseVolunteer(
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

export function parseClassInfo(
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
