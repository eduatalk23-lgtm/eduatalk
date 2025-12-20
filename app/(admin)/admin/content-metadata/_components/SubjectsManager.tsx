"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { warningMessageStyles } from "@/lib/utils/darkMode";

/**
 * @deprecated 이 컴포넌트는 더 이상 사용되지 않습니다.
 * 과목 관리는 `/admin/subjects` 페이지에서 통합 관리됩니다.
 * 
 * 이 컴포넌트는 하위 호환성을 위해 유지되며, 사용자를 새로운 페이지로 안내합니다.
 */
export function SubjectsManager() {
  return (
    <div className="space-y-4">
      {/* 경고 및 안내 메시지 */}
      <div className={warningMessageStyles.container}>
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-400 text-xl">⚠️</div>
          <div className="flex flex-1 flex-col gap-2">
            <h3 className={warningMessageStyles.title}>이 페이지는 더 이상 사용되지 않습니다</h3>
            <p className={warningMessageStyles.text}>
              과목 관리는 통합된{" "}
              <Link
                href="/admin/subjects"
                className={cn(
                  "font-semibold underline hover:no-underline",
                  warningMessageStyles.link
                )}
              >
                교과/과목 관리 페이지
              </Link>
              에서 진행해주세요.
            </p>
            <div className="mt-4">
              <Link
                href="/admin/subjects"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700",
                  warningMessageStyles.link
                )}
                style={{ textDecoration: "none" }}
              >
                교과/과목 관리 페이지로 이동
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

