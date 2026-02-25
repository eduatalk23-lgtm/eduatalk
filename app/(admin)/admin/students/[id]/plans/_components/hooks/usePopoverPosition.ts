'use client';

import { useRef, useEffect } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  type Placement,
} from '@floating-ui/react';

interface VirtualRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UsePopoverPositionOptions {
  /** 가상 요소의 뷰포트 좌표 기반 rect */
  virtualRect: VirtualRect | null;
  /** Floating UI placement (default: 'right-start') */
  placement?: Placement;
  /** offset 거리 (default: 8) */
  offsetPx?: number;
  /** flip/shift padding (default: 8) */
  padding?: number;
  /** 팝오버 열림 여부 */
  open: boolean;
}

/**
 * Floating UI 기반 팝오버 포지셔닝 훅
 * 가상 요소(클릭 좌표, DOMRect) 기반으로 뷰포트 경계 자동 대응
 */
export function usePopoverPosition({
  virtualRect,
  placement = 'right-start',
  offsetPx = 8,
  padding = 8,
  open,
}: UsePopoverPositionOptions) {
  const virtualRef = useRef<{
    getBoundingClientRect: () => DOMRect;
  } | null>(null);

  const { refs, floatingStyles, placement: resolvedPlacement, isPositioned, update } = useFloating({
    placement,
    strategy: 'fixed', // portal → document.body이므로 viewport 기준 fixed
    open,
    middleware: [
      offset(offsetPx),
      flip({ padding }),
      shift({ padding, crossAxis: true }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // virtualRect이 변경될 때마다 가상 reference 업데이트
  useEffect(() => {
    if (!virtualRect) {
      virtualRef.current = null;
      return;
    }

    virtualRef.current = {
      getBoundingClientRect: () =>
        DOMRect.fromRect({
          x: virtualRect.x,
          y: virtualRect.y,
          width: virtualRect.width,
          height: virtualRect.height,
        }),
    };

    refs.setPositionReference(virtualRef.current);
    update();
  }, [virtualRect?.x, virtualRect?.y, virtualRect?.width, virtualRect?.height, refs, update]);

  return { refs, floatingStyles, resolvedPlacement, isPositioned };
}

/** resolvedPlacement → CSS transformOrigin 변환 (GCal 스타일: 이벤트 방향 중앙 기준) */
export function placementToTransformOrigin(placement: string): string {
  // GCal: 팝오버가 이벤트 방향에서 자연스럽게 나타나도록 반대쪽 중앙 기준 스케일
  if (placement.startsWith('right')) return 'left center';
  if (placement.startsWith('left')) return 'right center';
  if (placement.startsWith('bottom')) return 'center top';
  if (placement.startsWith('top')) return 'center bottom';
  return 'center center';
}
