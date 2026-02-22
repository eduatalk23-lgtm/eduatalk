/**
 * 드래그 중 스크롤 컨테이너 상/하단 경계에서 자동 스크롤을 활성화하는 유틸리티.
 * 경계 근접도에 비례하여 스크롤 속도가 증가한다.
 */

const EDGE_ZONE_PX = 60;
const MAX_SPEED = 8; // px/frame

export function createDragAutoScroll(scrollContainer: HTMLElement) {
  let rafId: number | null = null;
  let lastClientY = 0;
  let active = false;

  function tick() {
    if (!active) return;

    const rect = scrollContainer.getBoundingClientRect();
    const distFromTop = lastClientY - rect.top;
    const distFromBottom = rect.bottom - lastClientY;

    let speed = 0;
    if (distFromTop < EDGE_ZONE_PX && distFromTop >= 0) {
      // 상단 영역 — 위로 스크롤
      const ratio = 1 - distFromTop / EDGE_ZONE_PX;
      speed = -(ratio * MAX_SPEED);
    } else if (distFromBottom < EDGE_ZONE_PX && distFromBottom >= 0) {
      // 하단 영역 — 아래로 스크롤
      const ratio = 1 - distFromBottom / EDGE_ZONE_PX;
      speed = ratio * MAX_SPEED;
    }

    if (speed !== 0) {
      scrollContainer.scrollTop += speed;
    }

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      active = true;
      rafId = requestAnimationFrame(tick);
    },
    update(clientY: number) {
      lastClientY = clientY;
    },
    stop() {
      active = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
