import { ReactNode } from "react";
import { getContainerClass, type LAYOUT_WIDTHS } from "@/lib/constants/layout";
import { cn } from "@/lib/cn";

type PageContainerProps = {
  children: ReactNode;
  widthType?: keyof typeof LAYOUT_WIDTHS;
  padding?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * 페이지 컨테이너 컴포넌트
 * 
 * 일관된 레이아웃 너비와 패딩을 제공합니다.
 * Spacing-First 정책을 준수하며, getContainerClass 유틸리티를 활용합니다.
 * 
 * @example
 * <PageContainer widthType="FORM">
 *   <div className="flex flex-col gap-6">
 *     <PageHeader title="프로필" />
 *     <FormContent />
 *   </div>
 * </PageContainer>
 */
export default function PageContainer({
  children,
  widthType = "LIST",
  padding = "md",
  className,
}: PageContainerProps) {
  return (
    <section className={cn(getContainerClass(widthType, padding), className)}>
      {children}
    </section>
  );
}











