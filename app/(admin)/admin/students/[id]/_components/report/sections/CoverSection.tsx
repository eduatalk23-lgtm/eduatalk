interface CoverSectionProps {
  studentName: string | null;
  schoolName: string | null;
  grade: number;
  className: string | null;
  targetMajor: string | null;
  consultantName: string | null;
  generatedAt: string;
}

export function CoverSection({
  studentName,
  schoolName,
  grade,
  className,
  targetMajor,
  consultantName,
  generatedAt,
}: CoverSectionProps) {
  const date = new Date(generatedAt);
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center text-center print-avoid-break">
      <h1 className="text-3xl font-bold text-gray-900">수시 컨설팅 Report</h1>

      <div className="mt-10 space-y-3 text-lg text-gray-700">
        <p className="text-2xl font-semibold text-gray-900">
          {studentName ?? "이름 없음"}
        </p>
        <p>
          {schoolName ?? "-"} {grade}학년{className ? ` ${className}반` : ""}
        </p>
        {targetMajor && (
          <p className="text-base text-gray-500">목표 전공: {targetMajor}</p>
        )}
      </div>

      <div className="mt-12 space-y-1 text-sm text-gray-500">
        {consultantName && <p>담당 컨설턴트: {consultantName}</p>}
        <p>작성일: {dateStr}</p>
      </div>
    </section>
  );
}
