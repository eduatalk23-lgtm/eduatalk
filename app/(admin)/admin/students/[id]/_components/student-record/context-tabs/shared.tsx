"use client";

// ============================================
// context-tabs/shared — 공통 UI 원자 컴포넌트
// ContextTabContent 하위 탭 파일들이 공유
// ============================================

export function PlaceholderTab() {
  return <p className="py-8 text-center text-xs text-[var(--text-tertiary)]">준비 중</p>;
}

export function EmptyMessage({ children }: { children: string }) {
  return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">{children}</p>;
}

export function LoadingMessage() {
  return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">로드 중...</p>;
}

export function ErrorMessage({ children }: { children: string }) {
  return <p className="py-4 text-center text-xs text-red-500">{children}</p>;
}
