import type { CSSProperties } from "react";

/**
 * 동적 너비를 위한 스타일 생성
 * 인라인 스타일을 최소화하면서 동적 값을 처리
 */
export function createWidthStyle(width: number): CSSProperties {
  return { width: `${width}%` };
}

/**
 * 동적 높이를 위한 스타일 생성
 */
export function createHeightStyle(height: number, minHeight?: string): CSSProperties {
  const style: CSSProperties = { height: `${height}%` };
  if (minHeight) {
    style.minHeight = minHeight;
  }
  return style;
}

/**
 * 동적 위치를 위한 스타일 생성
 */
export function createPositionStyle(
  top?: number,
  left?: number,
  right?: number,
  bottom?: number
): CSSProperties {
  const style: CSSProperties = {};
  if (top !== undefined) style.top = `${top}%`;
  if (left !== undefined) style.left = `${left}%`;
  if (right !== undefined) style.right = `${right}%`;
  if (bottom !== undefined) style.bottom = `${bottom}%`;
  return style;
}

/**
 * 픽셀 단위 높이를 위한 스타일 생성
 * 타임라인 등 동적 높이 계산이 필요한 경우 사용
 */
export function createHeightPxStyle(height: number, minHeight?: string): CSSProperties {
  const style: CSSProperties = { height: `${height}px` };
  if (minHeight) {
    style.minHeight = minHeight;
  }
  return style;
}

/**
 * 픽셀 단위 위치를 위한 스타일 생성
 * 타임라인 등 동적 위치 계산이 필요한 경우 사용
 */
export function createPositionPxStyle(
  top?: number,
  left?: number,
  right?: number,
  bottom?: number
): CSSProperties {
  const style: CSSProperties = {};
  if (top !== undefined) style.top = `${top}px`;
  if (left !== undefined) style.left = `${left}px`;
  if (right !== undefined) style.right = `${right}px`;
  if (bottom !== undefined) style.bottom = `${bottom}px`;
  return style;
}

/**
 * 블록 위치 및 크기 스타일 생성 (픽셀 단위)
 * 타임라인 블록 렌더링에 최적화된 헬퍼 함수
 */
export function createBlockStyle(
  top: number,
  height: number,
  minHeight?: string
): CSSProperties {
  const style: CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
  };
  if (minHeight) {
    style.minHeight = minHeight;
  }
  return style;
}

