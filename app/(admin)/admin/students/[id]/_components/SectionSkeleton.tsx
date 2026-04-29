/**
 * 학생 상세 탭 본문용 공용 skeleton
 * — page.tsx 의 인라인 익명 fallback 3종(attendance/files/risk) 통합
 */

interface SectionSkeletonProps {
  /** 표시할 카드 수 (기본 1) — risk 탭처럼 grid-cols-2 일 때 columns=2 */
  columns?: 1 | 2;
  /** 카드 안에 표시할 줄 수 (기본 3) */
  rows?: number;
}

export function SectionSkeleton({ columns = 1, rows = 3 }: SectionSkeletonProps) {
  const cards = Array.from({ length: columns });
  return (
    <div
      className={columns === 2 ? "grid gap-6 md:grid-cols-2" : "flex flex-col"}
      aria-busy="true"
      aria-label="콘텐츠 로딩 중"
    >
      {cards.map((_, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-border bg-bg-primary p-6"
        >
          <div className="flex flex-col gap-3">
            {Array.from({ length: rows }).map((_, j) => (
              <div
                key={j}
                className="h-4 animate-pulse rounded bg-bg-tertiary"
                style={{
                  width: `${50 + ((j * 17) % 50)}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
