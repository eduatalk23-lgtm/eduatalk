import Link from "next/link";
import { getContainerClass } from "@/lib/constants/layout";
import { cn } from "@/lib/cn";

type ContentFormLayoutProps = {
  title: string;
  description: string;
  backHref?: string; // 수정 페이지에서만 사용
  children: React.ReactNode;
  className?: string;
};

export function ContentFormLayout({
  title,
  description,
  backHref,
  children,
  className,
}: ContentFormLayoutProps) {
  return (
    <section className={cn(getContainerClass("FORM", "lg"), "flex flex-col gap-6", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="text-sm text-gray-500 dark:text-gray-400 transition hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← 상세로 돌아가기
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      {children}
    </section>
  );
}

