// ============================================
// 크로스레퍼런스 감지 함수 (Detectors)
// cross-reference.ts에서 분리.
// 7종 엣지 감지 순수 함수 모음:
//   detectCompetencyShared, detectStorylineEdges, detectCourseSupports,
//   detectReadingEdges, detectThemeConvergence, detectTeacherValidation
// ============================================

import type { ActivityTag, StorylineLink, ReadingLink, RecordType } from "./types";
import type { CourseAdequacyResult } from "./types";
import { normalizeSubjectName } from "@/lib/domains/subject/normalize";
import type { CrossRefEdge } from "./cross-reference";

// ============================================
// record_type → 한글 라벨 (internal)
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

  const normalizedInput = normalizeSubjectName(subjectName);
  const isTaken = courseAdequacy.taken.some(
    (s) => normalizeSubjectName(s) === normalizedInput,
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
// G3-5: 키워드 추출 (테마 수렴 / 교사 검증용)
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
  recordTypeMap?: Map<string, RecordType>,
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
      // recordTypeMap 우선, 없으면 label 패턴 폴백
      const typeFromMap = recordTypeMap?.get(id);
      if (typeFromMap) {
        otherRecords.set(id, typeFromMap);
      } else {
        const label = recordLabelMap.get(id) ?? "";
        if (label.includes("세특")) otherRecords.set(id, "setek");
        else if (label.includes("활동")) otherRecords.set(id, "changche");
        else if (label.includes("행동") || label.includes("행특")) otherRecords.set(id, "haengteuk");
      }
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
  recordTypeMap?: Map<string, RecordType>,
): CrossRefEdge[] {
  // 행특 텍스트 찾기 — recordTypeMap 우선, 없으면 label 폴백
  const haengteukEntries: Array<{ id: string; content: string }> = [];
  for (const [id, content] of recordContentMap) {
    const type = recordTypeMap?.get(id);
    if (type) {
      if (type === "haengteuk") haengteukEntries.push({ id, content });
    } else {
      const label = recordLabelMap.get(id) ?? "";
      if (label.includes("행동") || label.includes("행특")) haengteukEntries.push({ id, content });
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
      const typeFromMap = recordTypeMap?.get(id);
      if (typeFromMap === "haengteuk") continue;
      const type = typeFromMap ?? (() => {
        const label = recordLabelMap.get(id) ?? "";
        if (label.includes("행동") || label.includes("행특")) return null;
        return label.includes("세특") ? "setek" as const : label.includes("활동") ? "changche" as const : null;
      })();
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
