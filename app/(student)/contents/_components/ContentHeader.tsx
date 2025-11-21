// 공통 콘텐츠 헤더 컴포넌트

type ContentHeaderProps = {
  title: string;
  subtitle?: string;
  icon: string;
  createdAt?: string;
};

export function ContentHeader({
  title,
  subtitle,
  icon,
  createdAt,
}: ContentHeaderProps) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {icon}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-gray-900">{title}</h1>
      {(subtitle || createdAt) && (
        <p className="mt-1 text-sm text-gray-500">
          {subtitle && `${subtitle}`}
          {subtitle && createdAt && " • "}
          {createdAt && `등록일 ${formatDate(createdAt)}`}
        </p>
      )}
    </>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

