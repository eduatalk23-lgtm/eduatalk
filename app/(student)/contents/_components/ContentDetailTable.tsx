// 공통 콘텐츠 상세 정보 테이블 컴포넌트

type DetailRow = {
  label: string;
  value: string | number | null;
  isUrl?: boolean;
};

type ContentDetailTableProps = {
  rows: DetailRow[];
};

export function ContentDetailTable({ rows }: ContentDetailTableProps) {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
  // null, undefined, 빈 문자열 처리
  // 값이 없으면 해당 행을 표시하지 않음 (빈 값 숨김)
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // URL인 경우 링크로 표시
  const isUrlValue = isUrl || (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://")));
  
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {isUrlValue ? (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-base text-indigo-600 hover:text-indigo-800 hover:underline break-all"
        >
          {String(value)}
        </a>
      ) : (
        <p className="mt-1 text-base text-gray-900">{String(value)}</p>
      )}
    </div>
  );
}

