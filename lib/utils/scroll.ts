/**
 * 스크롤을 페이지 상단으로 이동시키는 유틸리티 함수
 */
export function scrollToTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
}

