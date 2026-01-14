import { useState, TouchEvent } from "react";

type UseSwipeGestureProps = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
};

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 100,
}: UseSwipeGestureProps = {}) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeProgress, setSwipeProgress] = useState<number>(0);

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setSwipeProgress(0);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);

    // 스와이프 진행률 계산 (0-1)
    const distance = touchStart - currentX;
    
    // 왼쪽 스와이프 (닫기) 진행률
    if (distance > 0 && onSwipeLeft) {
      const progress = Math.min(distance / minSwipeDistance, 1);
      setSwipeProgress(progress);
    } 
    // 오른쪽 스와이프 (열기 - 필요한 경우 구현) 진행률
    else if (distance < 0 && onSwipeRight) {
       // 현재는 닫기 제스처(왼쪽 스와이프)에 집중되어 있음
       setSwipeProgress(0);
    }
    else {
      setSwipeProgress(0);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setSwipeProgress(0);
      return;
    }
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    } else if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }

    setSwipeProgress(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeProgress,
  };
}
