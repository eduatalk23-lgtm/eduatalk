// 공통 콘텐츠 상세 정보 테이블 컴포넌트

type DetailRow = {
  label: string;
  value: string | number | null;
};

type ContentDetailTableProps = {
  rows: DetailRow[];
};

export function ContentDetailTable({ rows }: ContentDetailTableProps) {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  // null, undefined, 빈 문자열 처리
  const displayValue = value === null || value === undefined || value === "" 
    ? "알 수 없음" 
    : String(value);
  
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-base text-gray-900">{displayValue}</p>
    </div>
  );
}

