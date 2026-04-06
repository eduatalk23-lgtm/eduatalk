// ============================================
// NEIS HTML 직접 파서 — AI 없이 즉시 파싱
// Python neis_to_docx.py 로직을 TypeScript로 포팅
// 클라이언트(브라우저) 전용
// ============================================

import type { RecordImportData } from "./types";
import { extractTextFromDom } from "./dom-extractor";
import { extractSchoolRecord, findSectionRanges } from "./section-mapper";
import { parseStudentInfo, parseAcademic, parseCreativeActivities, parseBehavior } from "./record-parsers";
import { parseAttendance, parseReading, parseAwards, parseVolunteer, parseClassInfo } from "./supplementary-parsers";

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
