// 공통 콘텐츠 헤더 컴포넌트
import Image from "next/image";
import { BookOpen, Video, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type ContentType = "book" | "lecture" | "custom" | string;

type ContentHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: string; // 하위 호환성을 위해 유지
  contentType?: ContentType; // 새로운 prop: 아이콘 자동 선택
  createdAt?: string;
  coverImageUrl?: string | null;
  className?: string;
};

// contentType에 따른 아이콘 매핑
const contentTypeIconMap: Record<ContentType, LucideIcon> = {
  book: BookOpen,
  lecture: Video,
  custom: FileText,
};

// icon 문자열에서 contentType 추출 (하위 호환성)
function getContentTypeFromIcon(icon?: string): ContentType {
  if (!icon) return "custom";
  if (icon.includes("교재") || icon.includes("📚")) return "book";
  if (icon.includes("강의") || icon.includes("🎧")) return "lecture";
  return "custom";
}

export function ContentHeader({
  title,
  subtitle,
  icon,
  contentType,
  createdAt,
  coverImageUrl,
  className,
}: ContentHeaderProps) {
  // contentType이 없으면 icon에서 추출
  const resolvedContentType = contentType || getContentTypeFromIcon(icon);
  const IconComponent = contentTypeIconMap[resolvedContentType] || FileText;

  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:gap-8", className)}>
      {coverImageUrl && (
        <div className="flex flex-shrink-0 justify-center md:justify-start">
          <div className="relative h-48 w-32 overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-[var(--elevation-4)] transition-base hover:scale-105 sm:h-64 sm:w-40 md:h-72 md:w-48">
            <Image
              src={coverImageUrl}
              alt={`${title} 표지`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 192px"
              priority={false}
            />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-1.5">
            <IconComponent className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            {icon || (resolvedContentType === "book" ? "교재" : resolvedContentType === "lecture" ? "강의" : "커스텀 콘텐츠")}
          </p>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl lg:text-4xl leading-tight">
          {title}
        </h1>
        {(subtitle || createdAt) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            {subtitle && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500" aria-hidden="true" />
                {subtitle}
              </span>
            )}
            {createdAt && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500" aria-hidden="true" />
                등록일 <time dateTime={createdAt} className="font-medium">{formatDate(createdAt)}</time>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

