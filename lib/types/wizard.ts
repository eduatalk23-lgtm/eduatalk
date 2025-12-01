/**
 * 플랜 그룹 위저드 관련 타입 정의
 * 타입 안전성 강화를 위한 중앙화된 타입 정의
 */

/**
 * 위저드 콘텐츠 타입 (타입 안전성 강화)
 */
export type WizardContent = {
  content_type: "book" | "lecture";
  content_id: string;
  start_range: number;
  end_range: number;
  title: string; // 필수
  subject_category: string; // 필수
  subject?: string; // 세부 과목 (선택사항, 예: 화법과 작문, 미적분)
  masterContentId?: string; // 추천 콘텐츠의 경우 원본 마스터 콘텐츠 ID
};

/**
 * 타입 가드: WizardContent인지 확인
 */
export function isValidWizardContent(content: unknown): content is WizardContent {
  if (typeof content !== "object" || content === null) {
    return false;
  }

  const c = content as Record<string, unknown>;

  return (
    (c.content_type === "book" || c.content_type === "lecture") &&
    typeof c.content_id === "string" &&
    typeof c.start_range === "number" &&
    typeof c.end_range === "number" &&
    typeof c.title === "string" &&
    typeof c.subject_category === "string" &&
    c.start_range >= 0 &&
    c.end_range > c.start_range
  );
}

/**
 * 타입 가드: WizardContent 배열인지 확인
 */
export function isValidWizardContentArray(
  contents: unknown
): contents is WizardContent[] {
  if (!Array.isArray(contents)) {
    return false;
  }

  return contents.every(isValidWizardContent);
}

/**
 * 부분적으로 유효한 WizardContent인지 확인 (타입 변환용)
 */
export function isPartialWizardContent(
  content: unknown
): content is Partial<WizardContent> & {
  content_type: "book" | "lecture";
  content_id: string;
  start_range: number;
  end_range: number;
} {
  if (typeof content !== "object" || content === null) {
    return false;
  }

  const c = content as Record<string, unknown>;

  return (
    (c.content_type === "book" || c.content_type === "lecture") &&
    typeof c.content_id === "string" &&
    typeof c.start_range === "number" &&
    typeof c.end_range === "number"
  );
}

/**
 * 부분 WizardContent를 완전한 WizardContent로 변환 (기본값 제공)
 */
export function normalizeWizardContent(
  content: Partial<WizardContent> & {
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
  }
): WizardContent {
  return {
    ...content,
    title: content.title || "제목 없음",
    subject_category: content.subject_category || "기타",
  };
}

/**
 * WizardContent 배열을 정규화
 */
export function normalizeWizardContentArray(
  contents: unknown[]
): WizardContent[] {
  return contents
    .filter(isPartialWizardContent)
    .map(normalizeWizardContent);
}

