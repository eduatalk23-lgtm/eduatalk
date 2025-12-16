// 공통 콘텐츠 상세 정보 테이블 컴포넌트

import { formatValue, isEmptyValue } from "@/lib/utils/formatValue";
import { isValidUrl } from "@/lib/utils/urlHelpers";
import { cn } from "@/lib/cn";
import { ExternalLink } from "lucide-react";

type DetailRow = {
  label: string;
  value: string | number | null | undefined;
  isUrl?: boolean;
};

type DetailSection = {
  title?: string;
  rows: DetailRow[];
};

type ContentDetailTableProps = {
  sections?: DetailSection[];
  rows?: DetailRow[]; // 하위 호환성
};

export function ContentDetailTable({
  sections,
  rows,
}: ContentDetailTableProps) {
  // 하위 호환성: rows가 제공되면 sections로 변환
  const resolvedSections: DetailSection[] = sections
    ? sections
    : rows
    ? [{ rows }]
    : [];

  if (resolvedSections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {resolvedSections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="flex flex-col gap-4">
          {section.title && (
            <h3 className="text-base font-semibold text-gray-900">
              {section.title}
            </h3>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {section.rows.map((row, rowIndex) => (
              <DetailRow
                key={row.label || rowIndex}
                label={row.label}
                value={row.value}
                isUrl={row.isUrl}
              />
            ))}
          </div>
        </div>
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
    <div className="flex flex-col gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      {isUrlValue ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-all inline-flex items-center gap-1.5 group"
          aria-label={`${label} 링크 열기`}
        >
          <span className="truncate">{String(value)}</span>
          <ExternalLink
            className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        </a>
      ) : (
        <p
          className={cn(
            "text-base font-medium",
            isEmpty ? "text-gray-400 italic" : "text-gray-900"
          )}
          aria-label={isEmpty ? `${label}: 정보 없음` : undefined}
        >
          {isEmpty ? "정보 없음" : displayValue}
        </p>
      )}
    </div>
  );
}
