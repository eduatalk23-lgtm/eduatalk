"use client";

import { ReactNode, Suspense } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { useSidebar } from "./SidebarContext";
import { ChevronLeft, ChevronRight, Pin, PinOff, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

type RoleBasedLayoutProps = {
  role: "student" | "admin" | "parent" | "consultant" | "superadmin";
  children: ReactNode;
  dashboardHref: string;
  roleLabel: string;
  showSidebar?: boolean;
  wrapper?: (children: ReactNode) => ReactNode;
  tenantInfo?: {
    name: string;
    type?: string;
  } | null;
};

function SidebarContent({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
}) {
  const { isCollapsed, isPinned, toggleCollapse, togglePin } = useSidebar();

  return (
    <>
      {/* 로고 및 컨트롤 */}
      <div className="border-b border-gray-200 p-4">
        <div className={cn(
          "flex items-center gap-2",
          isCollapsed ? "flex-col justify-center" : "justify-between"
        )}>
          {!isCollapsed ? (
            <a
              href={dashboardHref}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900"
            >
              <span>⏱️</span>
              <span>TimeLevelUp</span>
              <span className="ml-2 text-xs text-gray-500">{roleLabel}</span>
            </a>
          ) : (
            <a
              href={dashboardHref}
              className="flex items-center justify-center w-10 h-10 text-lg mb-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="TimeLevelUp"
              title="TimeLevelUp"
            >
              <span>⏱️</span>
            </a>
          )}
          <div className={cn(
            "flex items-center gap-1",
            isCollapsed && "flex-col w-full"
          )}>
            <button
              onClick={togglePin}
              className={cn(
                "p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors",
                isCollapsed && "w-full flex items-center justify-center"
              )}
              aria-label={isPinned ? "고정 해제" : "고정"}
              title={isPinned ? "고정 해제" : "고정"}
            >
              {isPinned ? (
                <Pin className="w-4 h-4" />
              ) : (
                <PinOff className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={toggleCollapse}
              className={cn(
                "p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors",
                isCollapsed && "w-full flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
              )}
              aria-label={isCollapsed ? "확장" : "축소"}
              title={isCollapsed ? "확장" : "축소"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 기관 정보 (Superadmin 제외 모든 역할) */}
      {tenantInfo && role !== "superadmin" && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm flex-shrink-0">🏢</span>
            <div
              className={cn(
                "flex-1 min-w-0 transition-opacity",
                isCollapsed && "opacity-0 w-0 overflow-hidden"
              )}
            >
              <div className="text-sm font-semibold text-gray-900 truncate">
                {tenantInfo.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 네비게이션 */}
      <div className="p-4">
        <CategoryNav
          role={
            role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role
          }
        />
      </div>

      {/* 하단 링크 */}
      <div className="border-t border-gray-200 p-4">
        <div className={cn("transition-opacity", isCollapsed && "opacity-0")}>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

function MobileSidebar({
  role,
  dashboardHref,
  roleLabel,
  tenantInfo,
}: {
  role: RoleBasedLayoutProps["role"];
  dashboardHref: string;
  roleLabel: string;
  tenantInfo?: RoleBasedLayoutProps["tenantInfo"];
}) {
  const { isMobileOpen, toggleMobile, closeMobile } = useSidebar();

  return (
    <>
      {/* 햄버거 버튼 */}
      <button
        onClick={toggleMobile}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors md:hidden"
        aria-label="메뉴 열기"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* 오버레이 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* 드로어 */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out md:hidden overflow-y-auto",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between gap-2">
              <a
                href={dashboardHref}
                className="flex items-center gap-2 text-lg font-semibold text-gray-900"
              >
                <span>⏱️</span>
                <span>TimeLevelUp</span>
                <span className="ml-2 text-xs text-gray-500">{roleLabel}</span>
              </a>
            <button
              onClick={closeMobile}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="메뉴 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
            </div>

        {/* 기관 정보 */}
            {tenantInfo && role !== "superadmin" && (
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏢</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {tenantInfo.name}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 카테고리 네비게이션 */}
            <div className="p-4">
          <CategoryNav
            role={
              role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role
            }
          />
            </div>

            {/* 하단 링크 */}
            <div className="border-t border-gray-200 p-4">
              <SignOutButton />
            </div>
      </aside>
    </>
  );
}

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
  tenantInfo,
}: RoleBasedLayoutProps) {
  const { isCollapsed, isPinned } = useSidebar();

  const content = (
    <div className="flex min-h-screen bg-gray-50">
      {/* 사이드바 네비게이션 (데스크톱) */}
      {showSidebar && (
        <aside
          className={cn(
            "hidden md:block border-r border-gray-200 bg-white transition-all duration-300 ease-in-out",
            isCollapsed ? "w-16" : "w-64",
            !isPinned && "md:absolute md:z-30"
          )}
        >
          <div className="sticky top-0 h-screen overflow-y-auto">
            <SidebarContent
              role={role}
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              tenantInfo={tenantInfo}
            />
          </div>
        </aside>
      )}

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col">
        {/* 상단 네비게이션 (모바일용) */}
        {showSidebar && (
          <nav className="md:hidden sticky top-0 z-50 border-b border-gray-200 bg-white">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <a
                  href={dashboardHref}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900"
                >
                  <span>⏱️</span>
                  <span>TimeLevelUp</span>
                  <span className="ml-2 text-xs text-gray-500">{roleLabel}</span>
                </a>
                <MobileSidebar
                  role={role}
                  dashboardHref={dashboardHref}
                  roleLabel={roleLabel}
                  tenantInfo={tenantInfo}
                />
              </div>
              {/* 기관 정보 (모바일 - Superadmin 제외 모든 역할) */}
              {tenantInfo && role !== "superadmin" && (
                <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏢</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {tenantInfo.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Breadcrumbs */}
        {showSidebar && (
          <Suspense fallback={null}>
            <Breadcrumbs role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />
          </Suspense>
        )}

        {/* 페이지 콘텐츠 - suppressHydrationWarning으로 hydration 불일치 방지 */}
        <div className="flex-1" suppressHydrationWarning>
          {children}
        </div>
      </main>
    </div>
  );

  return wrapper ? wrapper(content) : content;
}

