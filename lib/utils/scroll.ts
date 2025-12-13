/**
 * 스크롤을 페이지 상단으로 이동시키는 유틸리티 함수
 */
export function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
}

/**
 * 특정 필드로 스크롤 이동
 * @param fieldId 필드 ID (data-field-id 속성 값)
 */
export function scrollToField(fieldId: string): void {
  if (typeof window === "undefined") return;

  try {
    // data-field-id 속성을 가진 요소 검색
    const fieldElement = document.querySelector(
      `[data-field-id="${fieldId}"]`
    ) as HTMLElement | null;

    if (!fieldElement) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[scrollToField] 필드를 찾을 수 없습니다: ${fieldId}`);
      }
      return;
    }

    // 부드러운 스크롤로 요소를 뷰포트 중앙에 배치
    fieldElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // 포커스 가능한 요소는 포커스 설정 (스크롤 완료 후)
    const focusableElements = [
      "input",
      "button",
      "select",
      "textarea",
      "a",
    ];
    const tagName = fieldElement.tagName.toLowerCase();

    if (focusableElements.includes(tagName)) {
      setTimeout(() => {
        if (fieldElement.focus && typeof fieldElement.focus === "function") {
          fieldElement.focus();
        }
      }, 300);
    } else {
      // 포커스 가능한 자식 요소 찾기
      const focusableChild = fieldElement.querySelector(
        focusableElements.join(", ")
      ) as HTMLElement | null;

      if (focusableChild && focusableChild.focus) {
        setTimeout(() => {
          focusableChild.focus();
        }, 300);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[scrollToField] 오류 발생:`, error);
    }
  }
}

