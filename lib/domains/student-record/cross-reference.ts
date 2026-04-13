// ============================================
// 크로스레퍼런스 감지 엔진
// G2-1: 5종 + G3-5: 2종 = 7종 엣지 감지
//
// 분리된 모듈:
//   cross-reference-detectors.ts — 7종 detector 순수 함수
// ============================================

import type { ActivityTag, StorylineLink, ReadingLink, RecordType } from "./types";
import type { CourseAdequacyResult } from "./types";

// ============================================
// Detector 함수 re-export (외부 호환 유지)
// ============================================

export {
  detectCompetencyShared,
  detectStorylineEdges,
  detectCourseSupports,
  detectReadingEdges,
  detectThemeConvergence,
  detectTeacherValidation,
} from "./cross-reference-detectors";

import {
  detectCompetencyShared,
  detectStorylineEdges,
  detectCourseSupports,
  detectReadingEdges,
  detectThemeConvergence,
  detectTeacherValidation,
} from "./cross-reference-detectors";

// ============================================
// 1. 타입 정의
// ============================================

export type CrossRefEdgeType =
  | "COMPETENCY_SHARED"
  | "CONTENT_REFERENCE"
  | "TEMPORAL_GROWTH"
  | "COURSE_SUPPORTS"
  | "READING_ENRICHES"
  | "THEME_CONVERGENCE"
  | "TEACHER_VALIDATION";

export interface CrossRefEdge {
  type: CrossRefEdgeType;
  /** 연결 대상의 record_type */
  targetRecordType: RecordType | "score";
  /** 대상 레코드 UUID (DB 영속화 / drilldown용) */
  targetRecordId?: string;
  /** 대상 레코드 label (예: "1학년 수학 세특") */
  targetLabel: string;
  /** 연결 근거 요약 */
  reason: string;
  /** 공유 역량 항목 (COMPETENCY_SHARED용) */
  sharedCompetencies?: string[];
  /** 엣지 산출 맥락 (UI 구분용). DB 영속화 엣지일 때만 제공. */
  edgeContext?: "analysis" | "projected" | "synthesis_inferred";
}

// ============================================
// 2. 엣지 타입별 메타 (UI용)
// ============================================

export const EDGE_TYPE_META: Record<CrossRefEdgeType, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  COMPETENCY_SHARED: {
    label: "역량 공유",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  },
  CONTENT_REFERENCE: {
    label: "내용 연결",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
  },
  TEMPORAL_GROWTH: {
    label: "성장 경로",
    color: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800",
  },
  COURSE_SUPPORTS: {
    label: "교과 뒷받침",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  },
  READING_ENRICHES: {
    label: "독서 보강",
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
  },
  THEME_CONVERGENCE: {
    label: "테마 수렴",
    color: "text-cyan-700 dark:text-cyan-300",
    bgColor: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800",
  },
  TEACHER_VALIDATION: {
    label: "교사 검증",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  },
};

// ============================================
// 3. record_type → 한글 라벨 (buildConnectionGraph 내부용)
// ============================================

const RECORD_TYPE_LABELS: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  changche: "창체",
  haengteuk: "행특",
  reading: "독서",
  score: "성적",
};

// ============================================
// 4. 통합 감지 함수
// ============================================

export interface CrossRefInput {
  currentRecordIds: Set<string>;
  currentRecordType: RecordType;
  currentGrade: number;
  /** 세특인 경우 과목명 */
  subjectName?: string;
  allTags: ActivityTag[];
  storylineLinks: StorylineLink[];
  readingLinks: ReadingLink[];
  courseAdequacy: CourseAdequacyResult | null;
  /** record_id → display label */
  recordLabelMap: Map<string, string>;
  /** reading_id → book title */
  readingLabelMap: Map<string, string>;
  /** G3-5: record_id → content 텍스트 */
  recordContentMap?: Map<string, string>;
  /** record_id → grade (label 파싱 대신 DB 직접 전달, optional 폴백) */
  recordGradeMap?: Map<string, number>;
  /** record_id → record_type (label 파싱 대신 DB 직접 전달, optional 폴백) */
  recordTypeMap?: Map<string, RecordType>;
}

export function detectAllCrossReferences(input: CrossRefInput): CrossRefEdge[] {
  const edges: CrossRefEdge[] = [];

  edges.push(
    ...detectCompetencyShared(
      input.currentRecordIds,
      input.currentRecordType,
      input.allTags,
      input.recordLabelMap,
    ),
  );

  edges.push(
    ...detectStorylineEdges(
      input.currentRecordIds,
      input.currentGrade,
      input.storylineLinks,
      input.recordLabelMap,
    ),
  );

  edges.push(
    ...detectCourseSupports(
      input.subjectName,
      input.courseAdequacy,
    ),
  );

  edges.push(
    ...detectReadingEdges(
      input.currentRecordIds,
      input.readingLinks,
      input.readingLabelMap,
    ),
  );

  // G3-5: 텍스트 기반 감지 (recordContentMap 있을 때만)
  if (input.recordContentMap && input.recordContentMap.size > 0) {
    edges.push(
      ...detectThemeConvergence(
        input.currentRecordIds,
        input.currentRecordType,
        input.recordContentMap,
        input.recordLabelMap,
        input.allTags,
        input.recordTypeMap,
      ),
    );

    edges.push(
      ...detectTeacherValidation(
        input.currentRecordIds,
        input.currentRecordType,
        input.recordContentMap,
        input.recordLabelMap,
        input.recordTypeMap,
      ),
    );
  }

  return edges;
}

// ============================================
// 9. G2-2: 전체 연결 그래프 빌더
// ============================================

export interface ConnectionNode {
  nodeKey: string;
  recordIds: Set<string>;
  recordType: RecordType;
  label: string;
  grade: number;
  edges: CrossRefEdge[];
}

export interface ConnectionGraph {
  nodes: ConnectionNode[];
  totalEdges: number;
}

export interface CrossRefGlobalInput {
  allTags: ActivityTag[];
  storylineLinks: StorylineLink[];
  readingLinks: ReadingLink[];
  courseAdequacy: CourseAdequacyResult | null;
  recordLabelMap: Map<string, string>;
  readingLabelMap: Map<string, string>;
  /** G3-5: record_id → content 텍스트 */
  recordContentMap?: Map<string, string>;
  /** record_id → grade (label 파싱 대신 DB 직접 전달, optional 폴백) */
  recordGradeMap?: Map<string, number>;
  /** record_id → record_type (label 파싱 대신 DB 직접 전달, optional 폴백) */
  recordTypeMap?: Map<string, RecordType>;
}

/** 학생의 모든 레코드 노드를 열거하고 각 노드의 엣지를 감지 */
export function buildConnectionGraph(input: CrossRefGlobalInput): ConnectionGraph {
  // 1. 모든 유니크 레코드를 record_type + record_id로 수집
  const recordMeta = new Map<string, { recordType: RecordType; grade: number }>();

  // activityTags에서 추출 (record_type 직접 제공)
  for (const tag of input.allTags) {
    if (!recordMeta.has(tag.record_id)) {
      // grade: DB 맵 우선, 없으면 label 파싱 폴백
      const gradeFromMap = input.recordGradeMap?.get(tag.record_id);
      const grade = gradeFromMap ?? (() => {
        const label = input.recordLabelMap.get(tag.record_id) ?? "";
        const m = label.match(/^(\d)학년/);
        return m ? Number(m[1]) : 1;
      })();
      recordMeta.set(tag.record_id, {
        recordType: (input.recordTypeMap?.get(tag.record_id) ?? tag.record_type) as RecordType,
        grade,
      });
    }
  }

  // storylineLinks에서 추출
  for (const link of input.storylineLinks) {
    if (!recordMeta.has(link.record_id)) {
      recordMeta.set(link.record_id, {
        recordType: link.record_type as RecordType,
        grade: link.grade,
      });
    }
  }

  // readingLinks의 reading_id도 노드 (record_type="reading")
  for (const link of input.readingLinks) {
    if (!recordMeta.has(link.reading_id)) {
      recordMeta.set(link.reading_id, {
        recordType: "reading" as RecordType,
        grade: 0,
      });
    }
  }

  // 2. 각 record_id를 노드로 변환하고 엣지 감지
  const nodes: ConnectionNode[] = [];
  let totalEdges = 0;

  for (const [recordId, meta] of recordMeta) {
    const ids = new Set([recordId]);

    // subjectName 추출 (setek label에서: "2학년 수학 세특" → "수학")
    let subjectName: string | undefined;
    if (meta.recordType === "setek") {
      const label = input.recordLabelMap.get(recordId) ?? "";
      const subjectMatch = label.match(/\d학년\s+(.+?)\s+세특/);
      subjectName = subjectMatch?.[1];
    }

    const edges = detectAllCrossReferences({
      currentRecordIds: ids,
      currentRecordType: meta.recordType,
      currentGrade: meta.grade,
      subjectName,
      allTags: input.allTags,
      storylineLinks: input.storylineLinks,
      readingLinks: input.readingLinks,
      courseAdequacy: input.courseAdequacy,
      recordLabelMap: input.recordLabelMap,
      readingLabelMap: input.readingLabelMap,
      recordContentMap: input.recordContentMap,
    });

    if (edges.length === 0) continue;

    const nodeKey = `${meta.recordType}:${recordId}`;
    const label = input.recordLabelMap.get(recordId)
      ?? input.readingLabelMap.get(recordId)
      ?? `${RECORD_TYPE_LABELS[meta.recordType] ?? meta.recordType}`;

    nodes.push({ nodeKey, recordIds: ids, recordType: meta.recordType, label, grade: meta.grade, edges });
    totalEdges += edges.length;
  }

  // 엣지 많은 순으로 정렬
  nodes.sort((a, b) => b.edges.length - a.edges.length);

  return { nodes, totalEdges };
}
