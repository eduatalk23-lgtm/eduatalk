// 공통 콘텐츠 상세 레이아웃 컴포넌트
import { getContainerClass } from "@/lib/constants/layout";
import { cn } from "@/lib/cn";

type ContentDetailLayoutProps = {
  header: React.ReactNode;
  detailTable: React.ReactNode;
  additionalSections?: React.ReactNode[];
  actions: React.ReactNode;
  className?: string;
};

export function ContentDetailLayout({
  header,
  detailTable,
  additionalSections,
  actions,
  className,
}: ContentDetailLayoutProps) {
  return (
    <section className={cn(getContainerClass("CONTENT_DETAIL", "lg"), "flex flex-col gap-8", className)}>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        {/* 헤더 섹션 - 더 강조된 배경 */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
          {header}
        </div>

        {/* 상세 정보 섹션 */}
        <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-700">
          {detailTable}
        </div>

        {/* 추가 섹션들 */}
        {additionalSections?.map((section, idx) => {
          // null이나 undefined인 섹션은 렌더링하지 않음
          if (!section) return null;
          
          return (
            <div
              key={idx}
              className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-gray-50/30 dark:bg-gray-900/30"
            >
              {section}
            </div>
          );
        })}

        {/* 액션 버튼 섹션 */}
        <div className="p-6 md:p-8 bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700">
          {actions}
        </div>
      </div>
    </section>
  );
}

