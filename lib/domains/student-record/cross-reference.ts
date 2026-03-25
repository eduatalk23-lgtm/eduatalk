// ============================================
// 크로스레퍼런스 감지 엔진
// G2-1: 5종 + G3-5: 2종 = 7종 엣지 감지
// ============================================

import type { ActivityTag, StorylineLink, ReadingLink, RecordType } from "./types";
import type { CourseAdequacyResult } from "./types";

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
// 3. record_type → 한글 라벨
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
// 4. COMPETENCY_SHARED 감지
// 같은 역량 항목이 다른 영역에서도 발현되는 엣지
// ============================================

export function detectCompetencyShared(
  currentRecordIds: Set<string>,
  currentRecordType: RecordType,
  allTags: ActivityTag[],
  /** record_id → label 매핑 (예: setek id → "수학") */
  recordLabelMap: Map<string, string>,
): CrossRefEdge[] {
  // 현재 영역의 역량 항목 추출
  const currentCompetencies = new Set(
    allTags
      .filter((t) => currentRecordIds.has(t.record_id))
      .map((t) => t.competency_item),
  );
  if (currentCompetencies.size === 0) return [];

  // 다른 영역에서 같은 역량을 가진 태그 찾기
  const otherMatches = allTags.filter(
    (t) => !currentRecordIds.has(t.record_id) && currentCompetencies.has(t.competency_item),
  );

  // 대상 record_type별로 그룹화
  const grouped = new Map<string, { recordType: RecordType; competencies: Set<string> }>();
  for (const tag of otherMatches) {
    const key = `${tag.record_type}:${tag.record_id}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.competencies.add(tag.competency_item);
    } else {
      grouped.set(key, {
        recordType: tag.record_type as RecordType,
        competencies: new Set([tag.competency_item]),
      });
    }
  }

  // record_type 레벨로 병합 (세특 여러 과목 → "세특" 하나로)
  const byType = new Map<string, { competencies: Set<string>; firstRecordId: string }>();
  for (const [key, { recordType, competencies }] of grouped) {
    const recordId = key.split(":")[1];
    const existing = byType.get(recordType);
    if (existing) {
      for (const c of competencies) existing.competencies.add(c);
    } else {
      byType.set(recordType, { competencies: new Set(competencies), firstRecordId: recordId });
    }
  }

  const edges: CrossRefEdge[] = [];
  for (const [recordType, { competencies, firstRecordId }] of byType) {
    if (recordType === currentRecordType) continue;
    const shared = [...competencies];
    edges.push({
      type: "COMPETENCY_SHARED",
      targetRecordType: recordType as RecordType,
      targetRecordId: firstRecordId,
      targetLabel: RECORD_TYPE_LABELS[recordType] ?? recordType,
      reason: `동일 역량 ${shared.length}개 공유`,
      sharedCompetencies: shared,
    });
  }

  return edges;
}

// ============================================
// 5. CONTENT_REFERENCE + TEMPORAL_GROWTH 감지
// storyline_links 기반
// ============================================

export function detectStorylineEdges(
  currentRecordIds: Set<string>,
  currentGrade: number,
  storylineLinks: StorylineLink[],
  recordLabelMap: Map<string, string>,
): CrossRefEdge[] {
  // 현재 영역이 속한 스토리라인 찾기
  const myStorylineIds = new Set(
    storylineLinks
      .filter((l) => currentRecordIds.has(l.record_id))
      .map((l) => l.storyline_id),
  );
  if (myStorylineIds.size === 0) return [];

  // 같은 스토리라인의 다른 링크
  const relatedLinks = storylineLinks.filter(
    (l) => myStorylineIds.has(l.storyline_id) && !currentRecordIds.has(l.record_id),
  );

  const edges: CrossRefEdge[] = [];
  const seen = new Set<string>();

  for (const link of relatedLinks) {
    const key = `${link.record_type}:${link.record_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const label = recordLabelMap.get(link.record_id)
      ?? `${link.grade}학년 ${RECORD_TYPE_LABELS[link.record_type] ?? link.record_type}`;

    const isGrowth = link.grade !== currentGrade;
    edges.push({
      type: isGrowth ? "TEMPORAL_GROWTH" : "CONTENT_REFERENCE",
      targetRecordType: link.record_type as RecordType,
      targetRecordId: link.record_id,
      targetLabel: label,
      reason: isGrowth
        ? `${Math.min(link.grade, currentGrade)}→${Math.max(link.grade, currentGrade)}학년 심화`
        : link.connection_note ?? "서사적 연결",
    });
  }

  return edges;
}

// ============================================
// 6. COURSE_SUPPORTS 감지
// 현재 과목이 목표 전공의 추천 과목인지
// ============================================

export function detectCourseSupports(
  subjectName: string | undefined,
  courseAdequacy: CourseAdequacyResult | null,
): CrossRefEdge[] {
  if (!subjectName || !courseAdequacy) return [];

  const isTaken = courseAdequacy.taken.some(
    (s) => s === subjectName,
  );
  if (!isTaken) return [];

  return [{
    type: "COURSE_SUPPORTS",
    targetRecordType: "score" as RecordType | "score",
    targetLabel: courseAdequacy.majorCategory,
    reason: `${courseAdequacy.majorCategory} 계열 추천 교과`,
  }];
}

// ============================================
// 7. READING_ENRICHES 감지
// reading_links 기반
// ============================================

export function detectReadingEdges(
  currentRecordIds: Set<string>,
  readingLinks: ReadingLink[],
  readingLabelMap: Map<string, string>,
): CrossRefEdge[] {
  // 현재 영역을 참조하는 독서 링크 찾기
  const matchingLinks = readingLinks.filter(
    (l) => currentRecordIds.has(l.record_id),
  );

  return matchingLinks.map((link) => ({
    type: "READING_ENRICHES" as const,
    targetRecordType: "reading" as RecordType,
    targetRecordId: link.reading_id,
    targetLabel: readingLabelMap.get(link.reading_id) ?? "독서",
    reason: link.connection_note ?? "독서 연결",
  }));
}

// ============================================
// 8. G3-5: 키워드 추출 (테마 수렴 / 교사 검증용)
// ============================================

const STOPWORDS = new Set([
  "학생", "수업", "활동", "통해", "관련", "대한", "대해", "위해", "과정",
  "참여", "적극", "성실", "노력", "보여", "모습", "이해", "능력", "태도",
  "발표", "작성", "내용", "결과", "조사", "분석", "설명", "자신", "다양",
  "것을", "하여", "에서", "으로", "하는", "있는", "했다", "한다", "에게",
]);

/** 텍스트에서 의미 있는 키워드 추출 (3글자+, 불용어 제거) */
function extractKeywords(text: string): string[] {
  if (!text || text.length < 10) return [];
  const normalized = text
    .replace(/[.,;:!?'"()（）「」『』\[\]<>·\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter((w) => w.length >= 3);
  const unique = new Set<string>();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!STOPWORDS.has(lower)) unique.add(lower);
  }
  return [...unique];
}

// ============================================
// 8a. THEME_CONVERGENCE 감지
// 서로 다른 영역의 텍스트에서 키워드 3개 이상 공유
// ============================================

export function detectThemeConvergence(
  currentRecordIds: Set<string>,
  currentRecordType: RecordType,
  recordContentMap: Map<string, string>,
  recordLabelMap: Map<string, string>,
  allTags: ActivityTag[],
): CrossRefEdge[] {
  // 현재 영역 텍스트 합산
  const currentTexts: string[] = [];
  for (const id of currentRecordIds) {
    const content = recordContentMap.get(id);
    if (content) currentTexts.push(content);
  }
  if (currentTexts.length === 0) return [];
  const currentKeywords = new Set(extractKeywords(currentTexts.join(" ")));
  if (currentKeywords.size < 3) return [];

  // 다른 영역의 record_id → record_type 매핑 (activityTags에서 추출)
  const otherRecords = new Map<string, RecordType>();
  for (const tag of allTags) {
    if (!currentRecordIds.has(tag.record_id) && tag.record_type !== currentRecordType) {
      otherRecords.set(tag.record_id, tag.record_type as RecordType);
    }
  }
  // recordContentMap에 있지만 tags에 없는 레코드도 추가
  for (const [id] of recordContentMap) {
    if (!currentRecordIds.has(id) && !otherRecords.has(id)) {
      const label = recordLabelMap.get(id) ?? "";
      // label 패턴으로 record_type 추론
      if (label.includes("세특")) otherRecords.set(id, "setek");
      else if (label.includes("활동")) otherRecords.set(id, "changche");
      else if (label.includes("행동") || label.includes("행특")) otherRecords.set(id, "haengteuk");
    }
  }

  // record_type별로 그룹화하여 키워드 교차 매칭
  const byType = new Map<string, { keywords: Set<string>; labels: string[]; firstId: string }>();
  for (const [id, recordType] of otherRecords) {
    if (recordType === currentRecordType) continue;
    const content = recordContentMap.get(id);
    if (!content) continue;
    const entry = byType.get(recordType) ?? { keywords: new Set<string>(), labels: [], firstId: id };
    for (const kw of extractKeywords(content)) entry.keywords.add(kw);
    entry.labels.push(recordLabelMap.get(id) ?? RECORD_TYPE_LABELS[recordType] ?? recordType);
    byType.set(recordType, entry);
  }

  const edges: CrossRefEdge[] = [];
  for (const [recordType, { keywords, labels, firstId }] of byType) {
    const shared = [...currentKeywords].filter((kw) => keywords.has(kw));
    if (shared.length >= 3) {
      edges.push({
        type: "THEME_CONVERGENCE",
        targetRecordType: recordType as RecordType,
        targetRecordId: firstId,
        targetLabel: labels[0] ?? RECORD_TYPE_LABELS[recordType] ?? recordType,
        reason: `공유 키워드 ${shared.length}개: ${shared.slice(0, 3).join(", ")}`,
      });
    }
  }
  return edges;
}

// ============================================
// 8b. TEACHER_VALIDATION 감지
// 행특에서 세특/창체 키워드가 등장하면 교사가 교차 검증
// ============================================

export function detectTeacherValidation(
  currentRecordIds: Set<string>,
  currentRecordType: RecordType,
  recordContentMap: Map<string, string>,
  recordLabelMap: Map<string, string>,
): CrossRefEdge[] {
  // 행특 텍스트 찾기
  const haengteukEntries: Array<{ id: string; content: string }> = [];
  for (const [id, content] of recordContentMap) {
    const label = recordLabelMap.get(id) ?? "";
    if (label.includes("행동") || label.includes("행특")) {
      haengteukEntries.push({ id, content });
    }
  }
  if (haengteukEntries.length === 0) return [];

  const haengteukText = haengteukEntries.map((e) => e.content).join(" ");
  const haengteukKeywords = new Set(extractKeywords(haengteukText));
  if (haengteukKeywords.size < 3) return [];

  // 현재 영역이 행특이면: 세특/창체에서 행특이 검증하는 키워드 찾기
  if (currentRecordType === "haengteuk") {
    const otherTexts = new Map<string, { texts: string[]; firstId: string }>();
    for (const [id, content] of recordContentMap) {
      if (currentRecordIds.has(id)) continue;
      const label = recordLabelMap.get(id) ?? "";
      if (label.includes("행동") || label.includes("행특")) continue;
      const type = label.includes("세특") ? "setek" : label.includes("활동") ? "changche" : null;
      if (!type) continue;
      const entry = otherTexts.get(type) ?? { texts: [], firstId: id };
      entry.texts.push(content);
      otherTexts.set(type, entry);
    }

    const edges: CrossRefEdge[] = [];
    for (const [type, { texts, firstId }] of otherTexts) {
      const otherKeywords = new Set(extractKeywords(texts.join(" ")));
      const shared = [...haengteukKeywords].filter((kw) => otherKeywords.has(kw));
      if (shared.length >= 2) {
        edges.push({
          type: "TEACHER_VALIDATION",
          targetRecordType: type as RecordType,
          targetRecordId: firstId,
          targetLabel: RECORD_TYPE_LABELS[type] ?? type,
          reason: `행특에서 입증: ${shared.slice(0, 3).join(", ")}`,
        });
      }
    }
    return edges;
  }

  // 현재 영역이 세특/창체이면: 행특이 이 영역을 검증하는지 확인
  const currentTexts: string[] = [];
  for (const id of currentRecordIds) {
    const content = recordContentMap.get(id);
    if (content) currentTexts.push(content);
  }
  if (currentTexts.length === 0) return [];

  const currentKeywords = new Set(extractKeywords(currentTexts.join(" ")));
  const shared = [...currentKeywords].filter((kw) => haengteukKeywords.has(kw));
  if (shared.length >= 2) {
    return [{
      type: "TEACHER_VALIDATION",
      targetRecordType: "haengteuk",
      targetRecordId: haengteukEntries[0]?.id,
      targetLabel: haengteukEntries[0] ? (recordLabelMap.get(haengteukEntries[0].id) ?? "행특") : "행특",
      reason: `행특에서 입증: ${shared.slice(0, 3).join(", ")}`,
    }];
  }
  return [];
}

// ============================================
// 9. 통합 감지 함수
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
      ),
    );

    edges.push(
      ...detectTeacherValidation(
        input.currentRecordIds,
        input.currentRecordType,
        input.recordContentMap,
        input.recordLabelMap,
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
}

/** 학생의 모든 레코드 노드를 열거하고 각 노드의 엣지를 감지 */
export function buildConnectionGraph(input: CrossRefGlobalInput): ConnectionGraph {
  // 1. 모든 유니크 레코드를 record_type + record_id로 수집
  const recordMeta = new Map<string, { recordType: RecordType; grade: number }>();

  // activityTags에서 추출 (record_type 직접 제공)
  for (const tag of input.allTags) {
    if (!recordMeta.has(tag.record_id)) {
      // grade는 label에서 파싱 (recordLabelMap: "2학년 수학 세특" → grade=2)
      const label = input.recordLabelMap.get(tag.record_id) ?? "";
      const gradeMatch = label.match(/^(\d)학년/);
      recordMeta.set(tag.record_id, {
        recordType: tag.record_type as RecordType,
        grade: gradeMatch ? Number(gradeMatch[1]) : 0,
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
