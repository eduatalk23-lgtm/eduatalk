// ============================================
// 파일명/폴더명에서 합격 메타데이터 추출
// ============================================

import { createHash } from "crypto";
import {
  UNIVERSITY_ALIASES,
  getCurriculumRevision,
  estimateEnrollmentYear,
} from "../constants";
import type { ExemplarParsedData } from "../types";

/** 파일명에서 추출한 메타데이터 */
export interface FileMetadata {
  studentName: string | null;
  schoolName: string | null;
  universities: { name: string; department?: string }[];
  admissionYear: number | null;
  filePath: string;
  fileFormat: "pdf" | "docx" | "hwp";
}

/**
 * 폴더 구조 + 파일명에서 메타데이터 추출
 *
 * 지원 패턴:
 * - "2015 합격 학생부 13/고동현(khj2198)_서울대 인문/학교생활기록부.pdf"
 * - "2017 합격학과 학생부 100/1_강희찬_영동고_학생부_공정무역전문.pdf"
 * - "2019 합격 학생부/생기부(강채아)_이화여대.pdf"
 * - "2020년 이후 합격 학생부/김의진_3-1학기 생기부_서울대,서강대,중앙대.pdf"
 */
export function extractFileMetadata(filePath: string): FileMetadata {
  // macOS NFD → NFC 정규화 (한글 분리형 → 조합형, readdirSync 호환)
  const normalizedPath = filePath.normalize("NFC");
  const ext = normalizedPath.split(".").pop()?.toLowerCase() ?? "pdf";
  const fileFormat = (ext === "hwp" ? "hwp" : ext === "docx" ? "docx" : "pdf") as FileMetadata["fileFormat"];

  // 폴더명에서 합격연도 추출
  const admissionYear = extractAdmissionYear(normalizedPath);

  // 학생 이름 추출
  const studentName = extractStudentName(normalizedPath);

  // 학교 이름 추출 (파일명에 포함된 경우)
  const schoolName = extractSchoolName(normalizedPath);

  // 대학 정보 추출
  const universities = extractUniversities(normalizedPath);

  return {
    studentName,
    schoolName,
    universities,
    admissionYear,
    filePath,  // 원본 경로 유지 (파일 읽기용)
    fileFormat,
  };
}

/** 폴더명에서 합격연도 추출 */
function extractAdmissionYear(filePath: string): number | null {
  // "2015 합격", "2017 합격", "2019 합격", "2020년 이후"
  const yearMatch = filePath.match(/(\d{4})\s*년?\s*(이후\s*)?합격/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    // "2020년 이후"는 2020~2024 범위
    return year;
  }
  return null;
}

/** 파일명에서 학생 이름 추출 */
function extractStudentName(filePath: string): string | null {
  const fileName = filePath.split("/").pop() ?? "";
  const dirName = filePath.split("/").slice(-2, -1)[0] ?? "";

  // 패턴 1: "생기부(이름)_대학.pdf"
  const paren1 = fileName.match(/(?:생기부|학생부)\(([가-힣]{2,4})\)/);
  if (paren1) return paren1[1];

  // 패턴 2: "이름_..." (파일명 시작이 한글 이름)
  const nameStart = fileName.match(/^(?:\d+_)?([가-힣]{2,4})_/);
  if (nameStart) return nameStart[1];

  // 패턴 3: "생기부 최종 (이름)_..."
  const paren2 = fileName.match(/\(([가-힣]{2,4})\)/);
  if (paren2) return paren2[1];

  // 패턴 4: 폴더명 "이름(id)_대학"
  const dirMatch = dirName.match(/^([가-힣]{2,4})\(/);
  if (dirMatch) return dirMatch[1];

  // 패턴 5: "이름 학생부_대학.pdf"
  const spaceName = fileName.match(/([가-힣]{2,4})\s*(?:학생부|생기부|학교생활기록부|세특)/);
  if (spaceName) return spaceName[1];

  return null;
}

/** 파일명에서 학교 이름 추출 */
function extractSchoolName(filePath: string): string | null {
  const fileName = filePath.split("/").pop() ?? "";

  // "이름_학교명_학생부" 패턴 (2017 폴더)
  const schoolMatch = fileName.match(/_([가-힣]+(?:고|고등학교))_/);
  if (schoolMatch) return schoolMatch[1];

  // 폴더명에서 "학교명고 이름"
  const dirName = filePath.split("/").slice(-2, -1)[0] ?? "";
  const dirSchool = dirName.match(/([가-힣]+(?:고|고등학교))/);
  if (dirSchool) return dirSchool[1];

  return null;
}

/** 파일명/폴더명에서 대학 정보 추출 */
function extractUniversities(filePath: string): { name: string; department?: string }[] {
  const parts = filePath.split("/");
  const fileName = parts.pop() ?? "";
  const dirName = parts[parts.length - 1] ?? "";
  const results: { name: string; department?: string }[] = [];

  // 상위 폴더 3단계까지 탐색 (2015 패턴: 깊은 중첩)
  const ancestors = parts.slice(-3);

  for (const ancestor of ancestors) {
    // "이름_서울대 인문" 패턴
    const uniSpace = ancestor.match(/_([가-힣]+(?:대|여대|여))\s+([가-힣]+)/);
    if (uniSpace) {
      results.push({
        name: normalizeUniversity(uniSpace[1]),
        department: uniSpace[2],
      });
    }

    // "이름_경희대(언론정보)" 패턴
    const uniParen = ancestor.match(/_([가-힣]+(?:대|여대|여))\(([가-힣]+)\)/);
    if (uniParen && results.length === 0) {
      results.push({
        name: normalizeUniversity(uniParen[1]),
        department: uniParen[2],
      });
    }

    // "서울대(경영경제)" 패턴 (이름 뒤가 아닌 경우)
    const standaloneParen = ancestor.match(/([가-힣]+(?:대|여대|여))\(([가-힣]+)\)/);
    if (standaloneParen && results.length === 0) {
      results.push({
        name: normalizeUniversity(standaloneParen[1]),
        department: standaloneParen[2],
      });
    }
  }

  if (results.length > 0) return results;

  // 3) 파일명에서 대학 추출 (쉼표, 마침표, 공백 구분)
  // "김의진_3-1학기 생기부_서울대,서강대,중앙대.pdf"
  // "위례고 손효원 3학년_연세대.중앙대.pdf"
  const afterUnderscore = fileName.match(/_([^.]+)\.\w+$/);
  if (afterUnderscore) {
    const segment = afterUnderscore[1];
    extractUnisFromSegment(segment, results);
  }

  // 4) "생기부(이름)_대학.pdf" 패턴
  const afterParen = fileName.match(/\)_(.+?)\.\w+$/);
  if (afterParen && results.length === 0) {
    extractUnisFromSegment(afterParen[1], results);
  }

  return results;
}

/** 텍스트 세그먼트에서 대학명 추출 */
function extractUnisFromSegment(
  segment: string,
  results: { name: string; department?: string }[]
) {
  // 쉼표, 마침표, 공백으로 분리
  const parts = segment.split(/[,.\s]+/).filter(Boolean);

  for (const part of parts) {
    // "대", "대학", "대학교" 로 끝나는 것 + 특수 (카이스트, 유니스트, 포항공대)
    const uniMatch = part.match(
      /([가-힣]+(?:대학교|대학|대|여대|여|과기|시립)(?:\([가-힣]+\))?|카이스트|유니스트|포항공대)/
    );
    if (uniMatch) {
      const rawName = uniMatch[1];
      // 괄호 안 학과 추출
      const deptMatch = rawName.match(/([가-힣]+)\(([가-힣]+)\)/);
      if (deptMatch) {
        results.push({
          name: normalizeUniversity(deptMatch[1]),
          department: deptMatch[2],
        });
      } else {
        // 뒤에 학과명이 붙어있는 경우: "가천대간호" → 가천대 + 간호
        const attached = rawName.match(/^([가-힣]+(?:대학교|대학|대|여대|시립|과기))([가-힣]{2,})$/);
        if (attached && !isPartOfUniversityName(attached[2])) {
          results.push({
            name: normalizeUniversity(attached[1]),
            department: attached[2],
          });
        } else {
          results.push({ name: normalizeUniversity(rawName) });
        }
      }
    }
  }
}

/** 대학 이름 일부인지 확인 (예: "여자" in "이화여자대학교") */
function isPartOfUniversityName(text: string): boolean {
  return ["학교", "학교)", "여자"].includes(text);
}

/** 대학 약칭 → 정식명칭 변환 */
function normalizeUniversity(raw: string): string {
  // 괄호 제거
  const clean = raw.replace(/\(.*\)/, "").trim();
  return UNIVERSITY_ALIASES[clean] ?? clean;
}

/**
 * anonymous_id 생성 (SHA-256)
 * 동일 학생의 재파싱 시 중복 방지
 */
export function generateAnonymousId(
  name: string,
  schoolName: string,
  enrollmentYear: number
): string {
  const input = `${name}|${schoolName}|${enrollmentYear}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * 파싱된 데이터 + 파일 메타데이터 병합
 * 파서(Claude)가 추출한 정보와 파일명에서 추출한 메타데이터를 합침
 */
export function mergeMetadata(
  parsed: ExemplarParsedData,
  fileMeta: FileMetadata
): ExemplarParsedData {
  // 합격 정보: 파일 메타가 더 신뢰할 수 있음 (파서가 놓칠 수 있으므로)
  if (fileMeta.universities.length > 0 && parsed.admissions.length === 0) {
    parsed.admissions = fileMeta.universities.map((u) => ({
      universityName: u.name,
      department: u.department,
      admissionYear: fileMeta.admissionYear ?? parsed.studentInfo.enrollmentYear + 3,
    }));
  }

  // 교육과정 결정
  if (!parsed.studentInfo.curriculumRevision) {
    const year = parsed.studentInfo.enrollmentYear || (fileMeta.admissionYear ? estimateEnrollmentYear(fileMeta.admissionYear) : 2015);
    parsed.studentInfo.curriculumRevision = getCurriculumRevision(year);
  }

  return parsed;
}
