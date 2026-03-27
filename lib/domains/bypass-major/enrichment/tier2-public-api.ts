/**
 * Tier 2: 공공데이터포털 API 기반 커리큘럼 수집
 *
 * data.go.kr SchoolMajorInfoService에서 학과별 교육과정(과목 목록)을 가져옴.
 * Tier 1(Import) 다음으로 높은 신뢰도 (confidence 85).
 */

import {
  getSchoolMajorInfo,
  parseCurriculum,
  type SchoolMajorInfo,
} from "@/lib/services/dataGoKrApi";
import { logActionDebug } from "@/lib/logging/actionLogger";
import type { ParsedCourse } from "./types";

const LOG_CTX = { domain: "bypass-major", action: "enrichment.tier2" };

/** 공공 API 기본 confidence (구조화된 공식 데이터) */
const PUBLIC_API_CONFIDENCE = 85;

/** 최신 공시년도 (매년 갱신 필요 — getPubYears()로 동적 조회 가능) */
const DEFAULT_SVY_YR = "2025";

/**
 * 대학명 정규화 — API 검색 매칭률 향상
 * "서울대" → "서울대학교", 괄호 제거 등
 */
function normalizeUniversityName(name: string): string {
  let n = name.trim();
  // 괄호 내용 제거 (캠퍼스 표기 등)
  n = n.replace(/\(.*?\)/g, "").trim();
  // "~대" → "~대학교" 보정 (단, 이미 "대학교"이면 스킵)
  if (n.endsWith("대") && !n.endsWith("대학교")) {
    n += "학교";
  }
  return n;
}

/**
 * 학과명 매칭 — 정확 매칭 → 포함 매칭 → 단어 매칭 순서
 */
function findMatchingMajor(
  majors: SchoolMajorInfo[],
  targetDeptName: string,
): SchoolMajorInfo | null {
  const target = targetDeptName.trim();

  // 1. 정확 매칭 (운영 중인 학과 우선)
  const exactActive = majors.find(
    (m) => m.korMjrNm === target && m.schlMjrStatNm !== "폐과",
  );
  if (exactActive) return exactActive;

  const exact = majors.find((m) => m.korMjrNm === target);
  if (exact) return exact;

  // 2. 포함 매칭 ("컴퓨터공학" ⊂ "컴퓨터공학과")
  const contains = majors.find(
    (m) =>
      (m.korMjrNm.includes(target) || target.includes(m.korMjrNm)) &&
      m.schlMjrStatNm !== "폐과",
  );
  if (contains) return contains;

  // 3. "과/부/전공" 접미사 제거 후 매칭
  const stripped = target
    .replace(/(학과|학부|과|부|전공)$/, "")
    .trim();
  if (stripped !== target && stripped.length >= 2) {
    const strippedMatch = majors.find(
      (m) =>
        m.korMjrNm.replace(/(학과|학부|과|부|전공)$/, "").trim() === stripped &&
        m.schlMjrStatNm !== "폐과",
    );
    if (strippedMatch) return strippedMatch;
  }

  return null;
}

/**
 * 공공 API에서 학과 커리큘럼 조회
 *
 * @returns courses + confidence, 또는 매칭 실패 시 빈 배열
 */
export async function fetchPublicApiCurriculum(
  universityName: string,
  departmentName: string,
  options?: { svyYr?: string },
): Promise<{ courses: ParsedCourse[]; confidence: number }> {
  const svyYr = options?.svyYr ?? DEFAULT_SVY_YR;
  const normalizedUniv = normalizeUniversityName(universityName);

  // 1. API 호출 — 대학명으로 학과 목록 검색
  const result = await getSchoolMajorInfo({
    svyYr,
    schlKrnNm: normalizedUniv,
    numOfRows: 500,
  });

  if (result.items.length === 0) {
    logActionDebug(LOG_CTX, `API 결과 없음: ${normalizedUniv} (${svyYr})`);
    return { courses: [], confidence: 0 };
  }

  // 1.5. 대학명 정확 필터 (API는 부분 매칭이므로 "남서울대" 등 혼입 가능)
  const filtered = result.items.filter(
    (m) => m.schlNm === normalizedUniv || m.schlNm === universityName,
  );

  if (filtered.length === 0) {
    logActionDebug(LOG_CTX, `대학명 정확 매칭 실패: ${normalizedUniv} (후보 ${result.items.length}개, 필터 후 0개)`);
    return { courses: [], confidence: 0 };
  }

  // 2. 학과 매칭
  const matched = findMatchingMajor(filtered, departmentName);

  if (!matched) {
    logActionDebug(
      LOG_CTX,
      `학과 매칭 실패: ${normalizedUniv} / ${departmentName} (후보 ${result.items.length}개)`,
    );
    return { courses: [], confidence: 0 };
  }

  // 3. 교육과정 파싱
  const rawCourses = parseCurriculum(matched.edcCrseLtrCtnt);

  if (rawCourses.length === 0) {
    logActionDebug(LOG_CTX, `교육과정 비어있음: ${matched.schlNm} / ${matched.korMjrNm}`);
    return { courses: [], confidence: 0 };
  }

  // 4. ParsedCourse 변환
  const courses: ParsedCourse[] = rawCourses.map((name) => ({
    courseName: name,
    courseType: null, // API에서 과목유형 미제공
    semester: null, // API에서 학기정보 미제공
  }));

  logActionDebug(
    LOG_CTX,
    `성공: ${matched.schlNm} / ${matched.korMjrNm} → ${courses.length}개 과목`,
  );

  return { courses, confidence: PUBLIC_API_CONFIDENCE };
}
