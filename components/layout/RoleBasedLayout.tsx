"use client";

import { TopBar } from "./TopBar";
import { MobileSidebar } from "./MobileSidebar";
import { TopBarCenterSlotProvider } from "./TopBarCenterSlotContext";
import type { RoleBasedLayoutProps } from "./types";

export function RoleBasedLayout({
  role,
  children,
  dashboardHref,
  roleLabel,
  showSidebar = true,
  wrapper,
  tenantInfo,
  userName,
  profileImageUrl,
  userEmail,
  userId,
}: RoleBasedLayoutProps) {
  const content = (
    <TopBarCenterSlotProvider>
      <div className="flex flex-col min-h-dvh bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
        {/* TopBar - fixed, 64px */}
        {showSidebar && (
          <div className="print:hidden">
            <TopBar
              role={role}
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              userName={userName}
              profileImageUrl={profileImageUrl}
              userEmail={userEmail}
              userId={userId}
              tenantInfo={tenantInfo}
            />
          </div>
        )}

        {/* Main content area */}
        <div className={showSidebar ? "flex flex-1 pt-16" : "flex flex-1"}>
          <main
            id="main-content"
            className="flex-1 flex flex-col"
          >
            <div className="flex-1" suppressHydrationWarning>
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Sidebar Drawer */}
        {showSidebar && (
          <div className="print:hidden">
            <MobileSidebar
              role={role}
              dashboardHref={dashboardHref}
              roleLabel={roleLabel}
              tenantInfo={tenantInfo}
              userName={userName}
            />
          </div>
        )}
      </div>
    </TopBarCenterSlotProvider>
  );

  return wrapper ? wrapper(content) : content;
}
