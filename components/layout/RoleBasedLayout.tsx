import { ReactNode } from "react";
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
};

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
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
              <CategoryNav role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />
            </div>
          </nav>
        )}

        {/* Breadcrumbs */}
        {showSidebar && <Breadcrumbs role={role === "consultant" ? "admin" : role === "superadmin" ? "superadmin" : role} />}

        {/* 페이지 콘텐츠 */}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );

  return wrapper ? wrapper(content) : content;
}

