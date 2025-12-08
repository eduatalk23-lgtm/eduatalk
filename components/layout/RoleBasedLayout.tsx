import { ReactNode, Suspense } from "react";
import { CategoryNav } from "@/components/navigation/global/CategoryNav";
import { Breadcrumbs } from "@/components/navigation/global/Breadcrumbs";
import { SignOutButton } from "@/app/_components/SignOutButton";

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

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
  tenantInfo,
}: RoleBasedLayoutProps) {
  const content = (
    <div className="flex min-h-screen bg-gray-50">
      {/* 사이드바 네비게이션 */}
      {showSidebar && (
        <aside className="hidden md:block w-64 border-r border-gray-200 bg-white">
          <div className="sticky top-0 h-screen overflow-y-auto">
            {/* 로고 */}
            <div className="border-b border-gray-200 p-4">
              <a
                href={dashboardHref}
                className="flex items-center gap-2 text-lg font-semibold text-gray-900"
              >
                <span>⏱️</span>
                <span>TimeLevelUp</span>
                <span className="ml-2 text-xs text-gray-500">{roleLabel}</span>
              </a>
            </div>

            {/* 기관 정보 (Superadmin 제외 모든 역할) */}
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
              <CategoryNav role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />
            </div>

            {/* 하단 링크 */}
            <div className="border-t border-gray-200 p-4">
              <SignOutButton />
            </div>
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
              <CategoryNav role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />
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

