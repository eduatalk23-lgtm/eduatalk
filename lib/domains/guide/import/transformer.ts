/**
 * Access 가이드 데이터 → DB 스키마 변환
 *
 * 실제 Access DB 컬럼: 52개 (탐구DB_ver2_4.accdb "가이드" 테이블)
 * 이론 필드: 탐구이론 + 탐구이론2~7 (최대 7개 섹션)
 * 논문: 관련논문1/2 + 논문URL1/2 + 논문요약1
 * 도서: 관련도서1~7
 * 이미지: ImagePath1~7
 * 세특: 교과세특1/2
 */

import type {
  AccessGuideRow,
  GuideType,
  GuideUpsertInput,
  GuideContentInput,
  TheorySection,
  RelatedPaper,
} from "../types";

/** Access 구분유형 → guide_type 매핑 */
const GUIDE_TYPE_MAP: Record<string, GuideType> = {
  독서: "reading",
  독서탐구: "reading",
  "주제 탐구": "topic_exploration",
  주제탐구: "topic_exploration",
  교과수행: "subject_performance",
  "실험 및 연구": "experiment",
  실험탐구: "experiment",
  교육프로그램: "program",
  프로그램: "program",
};

function resolveGuideType(raw: string): GuideType {
  const trimmed = raw.trim();
  // 정확 매칭
  if (GUIDE_TYPE_MAP[trimmed]) return GUIDE_TYPE_MAP[trimmed];
  // 복합 값("실험 및 연구, 주제 탐구") → 첫 번째 값 사용
  const first = trimmed.split(",")[0]?.trim();
  if (first && GUIDE_TYPE_MAP[first]) return GUIDE_TYPE_MAP[first];
  return "topic_exploration";
}

/** 탐구이론 1~7을 theory_sections 배열로 합성 */
function buildTheorySections(row: AccessGuideRow): TheorySection[] {
  const sections: TheorySection[] = [];
  const theoryFields: Array<{ key: keyof AccessGuideRow; imageKey: keyof AccessGuideRow }> = [
    { key: "탐구이론", imageKey: "ImagePath1" },
    { key: "탐구이론2", imageKey: "ImagePath2" },
    { key: "탐구이론3", imageKey: "ImagePath3" },
    { key: "탐구이론4", imageKey: "ImagePath4" },
    { key: "탐구이론5", imageKey: "ImagePath5" },
    { key: "탐구이론6", imageKey: "ImagePath6" },
    { key: "탐구이론7", imageKey: "ImagePath7" },
  ];

  for (let i = 0; i < theoryFields.length; i++) {
    const text = String(row[theoryFields[i].key] ?? "").trim();
    if (!text) continue;

    const imagePath = String(row[theoryFields[i].imageKey] ?? "").trim();
    sections.push({
      order: sections.length + 1,
      title: `이론 ${sections.length + 1}`,
      content: text,
      ...(imagePath ? { image_path: imagePath } : {}),
    });
  }

  return sections;
}

/** 관련논문 1/2 → RelatedPaper 배열 */
function buildRelatedPapers(row: AccessGuideRow): RelatedPaper[] {
  const papers: RelatedPaper[] = [];

  const paper1 = String(row.관련논문1 ?? "").trim();
  if (paper1) {
    const url1 = String(row.논문URL1 ?? "").trim().replace(/^#|#$/g, "");
    const summary1 = String(row.논문요약1 ?? "").trim();
    papers.push({
      title: paper1,
      ...(url1 ? { url: url1 } : {}),
      ...(summary1 ? { summary: summary1 } : {}),
    });
  }

  const paper2 = String(row.관련논문2 ?? "").trim();
  if (paper2) {
    const url2 = String(row.논문URL2 ?? "").trim().replace(/^#|#$/g, "");
    papers.push({
      title: paper2,
      ...(url2 ? { url: url2 } : {}),
    });
  }

  return papers;
}

/** 관련도서 1~7 → 문자열 배열 */
function buildRelatedBooks(row: AccessGuideRow): string[] {
  const bookFields: Array<keyof AccessGuideRow> = [
    "관련도서1", "관련도서2", "관련도서3", "관련도서4",
    "관련도서5", "관련도서6", "관련도서7",
  ];
  return bookFields
    .map((k) => String(row[k] ?? "").trim())
    .filter((b) => b.length > 0);
}

/** ImagePath 1~7 → 문자열 배열 */
function buildImagePaths(row: AccessGuideRow): string[] {
  const imgFields: Array<keyof AccessGuideRow> = [
    "ImagePath1", "ImagePath2", "ImagePath3", "ImagePath4",
    "ImagePath5", "ImagePath6", "ImagePath7",
  ];
  return imgFields
    .map((k) => String(row[k] ?? "").trim())
    .filter((p) => p.length > 0);
}

/** 교과세특 1/2 → 문자열 배열 */
function buildSetekExamples(row: AccessGuideRow): string[] {
  const examples: string[] = [];
  const s1 = String(row.교과세특1 ?? "").trim();
  if (s1) examples.push(s1);
  const s2 = String(row.교과세특2 ?? "").trim();
  if (s2) examples.push(s2);
  return examples;
}

/** 출판연도 → 숫자 파싱 */
function parseBookYear(raw: string): number | undefined {
  if (!raw) return undefined;
  const year = parseInt(raw, 10);
  return isNaN(year) || year < 1900 || year > 2100 ? undefined : year;
}

/** 개정년도 정리: "2015년, 2022년" → "2015,2022" */
function normalizeCurriculumYear(raw: string): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw.replace(/년/g, "").replace(/\s/g, "").trim() || undefined;
}

// ============================================================
// 메인 변환 함수
// ============================================================

export interface TransformResult {
  guide: GuideUpsertInput;
  content: GuideContentInput;
  /** Access 원본 과목명 (매칭용) */
  originalSubjectName: string;
  /** Access 원본 계열 (매칭용) */
  originalCareerField: string;
}

/** Access 행 → guide + content 변환 */
export function transformAccessRow(row: AccessGuideRow): TransformResult {
  const guideType = resolveGuideType(row.구분유형);

  const guide: GuideUpsertInput = {
    legacyId: row.ID,
    guideType,
    curriculumYear: normalizeCurriculumYear(row.개정년도),
    subjectArea: row.교과선택?.trim() || undefined,
    subjectSelect: row.과목선택?.trim() || undefined,
    unitMajor: row.대단원선택?.trim() || undefined,
    unitMinor: row.소단원선택?.trim() || undefined,
    title: row.주제?.trim() || row.도서이름?.trim() || `[무제] #${row.ID}`,
    bookTitle: row.도서이름?.trim() || undefined,
    bookAuthor: row.저자?.trim() || undefined,
    bookPublisher: row.출판사?.trim() || undefined,
    bookYear: parseBookYear(row.출판연도),
    status: "approved",
    sourceType: "imported",
    contentFormat: "plain",
  };

  const content: GuideContentInput = {
    motivation: row.탐구동기?.trim() || undefined,
    theorySections: buildTheorySections(row),
    reflection: row.탐구고찰?.trim() || undefined,
    impression: row.느낀점?.trim() || undefined,
    summary: row.탐구요약?.trim() || undefined,
    followUp: row.후속탐구?.trim() || undefined,
    bookDescription: row.도서소개?.trim() || undefined,
    relatedPapers: buildRelatedPapers(row),
    relatedBooks: buildRelatedBooks(row),
    imagePaths: buildImagePaths(row),
    guideUrl: row.가이드URL?.trim() || undefined,
    setekExamples: buildSetekExamples(row),
    rawSource: row,
  };

  return {
    guide,
    content,
    originalSubjectName: row.과목선택?.trim() || "",
    originalCareerField: row.계열선택?.trim() || "",
  };
}
