import { cn } from "@/lib/cn";

interface EmptyProps {
  variant?: "inline" | "cell" | "card";
  label?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  /** variant="cell"에서 테이블 colspan 지정 */
  colSpan?: number;
}

/**
 * 생기부 도메인 공용 빈 상태 컴포넌트
 * - inline: 인라인 텍스트 (기본)
 * - cell: 테이블 셀 (colSpan 지원)
 * - card: 카드형 (기존 EmptyState 패턴 + 아이콘)
 */
export function Empty({
  variant = "inline",
  label = "데이터 없음",
  description,
  icon: Icon,
  className,
  colSpan,
}: EmptyProps) {
  if (variant === "cell") {
    return (
      <td
        colSpan={colSpan}
        className={cn(
          "px-3 py-4 text-center text-xs text-[var(--text-placeholder)]",
          className,
        )}
      >
        {label}
      </td>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 p-6 text-center dark:border-gray-700",
          className,
        )}
      >
        {Icon && <Icon className="h-8 w-8 text-[var(--text-placeholder)]" />}
        <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
        )}
      </div>
    );
  }

  // inline (기본)
  return (
    <span className={cn("text-xs text-[var(--text-placeholder)]", className)}>
      {label}
    </span>
  );
}
