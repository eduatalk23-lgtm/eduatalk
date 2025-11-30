// 공통 콘텐츠 헤더 컴포넌트
import Image from "next/image";

type ContentHeaderProps = {
  title: string;
  subtitle?: string;
  icon: string;
  createdAt?: string;
  coverImageUrl?: string | null;
};

export function ContentHeader({
  title,
  subtitle,
  icon,
  createdAt,
  coverImageUrl,
}: ContentHeaderProps) {
  return (
    <>
      {coverImageUrl && (
        <div className="mb-6 flex justify-center">
          <div className="relative h-48 w-32 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 sm:h-64 sm:w-40">
            <Image
              src={coverImageUrl}
              alt={`${title} 표지`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 128px, 160px"
            />
          </div>
        </div>
      )}
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

