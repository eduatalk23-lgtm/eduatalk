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

  const { refs, floatingStyles, placement: resolvedPlacement, update } = useFloating({
    placement,
    strategy: 'fixed', // portal → document.body이므로 viewport 기준 fixed
    open,
    middleware: [
      offset(offsetPx),
      flip({ padding }),
      shift({ padding }),
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

  return { refs, floatingStyles, resolvedPlacement };
}

/** resolvedPlacement → CSS transformOrigin 변환 */
export function placementToTransformOrigin(placement: string): string {
  if (placement.startsWith('right')) return 'left top';
  if (placement.startsWith('left')) return 'right top';
  if (placement.startsWith('bottom')) return 'top left';
  if (placement.startsWith('top')) return 'bottom left';
  return 'center center';
}
