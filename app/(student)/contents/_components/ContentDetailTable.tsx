// 공통 콘텐츠 상세 정보 테이블 컴포넌트

import { formatValue, isEmptyValue } from "@/lib/utils/formatValue";
import { isValidUrl } from "@/lib/utils/urlHelpers";
import { cn } from "@/lib/cn";

type DetailRow = {
  label: string;
  value: string | number | null | undefined;
  isUrl?: boolean;
};

type ContentDetailTableProps = {
  rows: DetailRow[];
};

export function ContentDetailTable({ rows }: ContentDetailTableProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} isUrl={row.isUrl} />
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
  isUrl = false,
}: {
  label: string;
  value: string | number | null | undefined;
  isUrl?: boolean;
}) {
  const isEmpty = isEmptyValue(value);
  const displayValue = formatValue(value);
  const isUrlValue = !isEmpty && (isUrl || isValidUrl(value as string));
  
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {isUrlValue ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base text-indigo-600 hover:text-indigo-800 hover:underline break-all"
          aria-label={`${label} 링크 열기`}
        >
          {String(value)}
        </a>
      ) : (
        <p 
          className={cn(
            "text-base",
            isEmpty ? "text-gray-400" : "text-gray-900"
          )}
          aria-label={isEmpty ? `${label}: 정보 없음` : undefined}
        >
          {displayValue}
        </p>
      )}
    </div>
  );
}

