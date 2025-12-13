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

