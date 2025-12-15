"use client";

import { ReactNode, Suspense } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSidebar } from "./SidebarContext";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { mapRoleForNavigation } from "@/lib/navigation/utils";

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
  const { isCollapsed, toggleCollapse } = useSidebar();

  return (
    <>
      {/* 로고 및 컨트롤 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <a
              href={dashboardHref}
              className="flex items-center justify-center w-10 h-10 text-lg rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="TimeLevelUp"
              title="TimeLevelUp"
            >
              <span>⏱️</span>
            </a>
            {/* 확장 버튼 - 더 크고 눈에 띄게 */}
            <button
              onClick={toggleCollapse}
              className="group relative w-full flex items-center justify-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition-colors border border-indigo-200 dark:border-indigo-800"
              aria-label="메뉴 펼치기"
              title="메뉴 펼치기"
            >
              <ChevronRight className="w-6 h-6 flex-shrink-0 text-indigo-700 dark:text-indigo-300" strokeWidth={2.5} />
              {/* 툴팁 */}
              <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden w-24 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-xs text-white dark:text-gray-900 opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 whitespace-nowrap z-50">
                메뉴 펼치기
                <div className="absolute right-full top-1/2 -translate-y-1/2">
                  <div className="border-4 border-transparent border-r-gray-900 dark:border-r-gray-100"></div>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <a
              href={dashboardHref}
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              <span>⏱️</span>
              <span>TimeLevelUp</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</span>
            </a>
            <button
              onClick={toggleCollapse}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              aria-label="축소"
              title="축소"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 기관 정보 (Superadmin 제외 모든 역할) */}
      {tenantInfo && role !== "superadmin" && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm flex-shrink-0">🏢</span>
            <div
              className={cn(
                "flex-1 min-w-0 transition-opacity",
                isCollapsed && "opacity-0 w-0 overflow-hidden"
              )}
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {tenantInfo.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 네비게이션 */}
      <div className="p-4">
        <CategoryNav
          role={mapRoleForNavigation(role)}
        />
      </div>

      {/* 하단 링크 */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className={cn("transition-opacity", isCollapsed && "opacity-0")}>
          <div className="flex items-center justify-between gap-2">
            <SignOutButton />
            <ThemeToggle />
          </div>
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
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors md:hidden"
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
          "fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-300 ease-in-out md:hidden overflow-y-auto",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 z-10">
          <div className="flex items-center justify-between gap-2">
              <a
                href={dashboardHref}
                className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                <span>⏱️</span>
                <span>TimeLevelUp</span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{roleLabel}</span>
              </a>
            <button
              onClick={closeMobile}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              aria-label="메뉴 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
            </div>

        {/* 기관 정보 */}
            {tenantInfo && role !== "superadmin" && (
              <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏢</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {tenantInfo.name}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 카테고리 네비게이션 */}
            <div className="p-4">
          <CategoryNav
            role={mapRoleForNavigation(role)}
          />
            </div>

            {/* 하단 링크 */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-2">
                <SignOutButton />
                <ThemeToggle />
              </div>
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
  const { isCollapsed } = useSidebar();

  const content = (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 사이드바 네비게이션 (데스크톱) */}
      {showSidebar && (
        <aside
          className={cn(
            "hidden md:block border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 ease-in-out",
            isCollapsed ? "w-16" : "w-64"
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
      <main id="main-content" className="flex-1 flex flex-col">
        {/* 상단 네비게이션 (모바일용) */}
        {showSidebar && (
          <nav className="md:hidden sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <a
                  href={dashboardHref}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  <span>⏱️</span>
                  <span>TimeLevelUp</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</span>
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
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏢</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
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
            <Breadcrumbs role={mapRoleForNavigation(role)} />
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

