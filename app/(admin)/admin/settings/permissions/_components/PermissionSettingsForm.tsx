"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  getPermissionDefinitionsAction,
  getRolePermissionsAction,
  setRolePermissionAction,
  resetRolePermissionsAction,
} from "@/lib/domains/settings/actions/permissions";
import type {
  PermissionKey,
  PermissionDefinition,
  RolePermission,
} from "@/lib/auth/permissions";

type PermissionSettingsFormProps = {
  tenantId: string;
};

type CategoryLabels = {
  [key: string]: string;
};

const CATEGORY_LABELS: CategoryLabels = {
  camp: "캠프 관리",
  student: "학생 관리",
  content: "콘텐츠 관리",
  attendance: "출석 관리",
  settings: "설정",
  user: "사용자 관리",
};

export function PermissionSettingsForm({ tenantId }: PermissionSettingsFormProps) {
  const { showSuccess, showError } = useToast();
  const [definitions, setDefinitions] = useState<PermissionDefinition[]>([]);
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // 권한 정의와 현재 설정을 동시에 로드
        const [defResult, permResult] = await Promise.all([
          getPermissionDefinitionsAction(),
          getRolePermissionsAction(tenantId),
        ]);

        if (defResult.success && defResult.data) {
          setDefinitions(defResult.data);
        }

        if (permResult.success && permResult.data) {
          const permMap = new Map<string, boolean>();
          for (const perm of permResult.data) {
            permMap.set(perm.permission_key, perm.is_allowed);
          }
          setPermissions(permMap);
        }
      } catch {
        showError("권한 설정을 불러오는데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [tenantId, showError]);

  // 권한 토글
  const handleToggle = async (permissionKey: PermissionKey) => {
    const currentValue = getPermissionValue(permissionKey);
    const newValue = !currentValue;

    // 낙관적 업데이트
    setPermissions((prev) => {
      const next = new Map(prev);
      next.set(permissionKey, newValue);
      return next;
    });

    const result = await setRolePermissionAction(tenantId, "consultant", permissionKey, newValue);

    if (!result.success) {
      // 실패 시 롤백
      setPermissions((prev) => {
        const next = new Map(prev);
        next.set(permissionKey, currentValue);
        return next;
      });
      showError(result.error || "권한 변경 실패");
    }
  };

  // 권한 값 가져오기 (설정이 없으면 기본값 사용)
  const getPermissionValue = (permissionKey: PermissionKey): boolean => {
    if (permissions.has(permissionKey)) {
      return permissions.get(permissionKey)!;
    }
    // 기본값 사용
    const def = definitions.find((d) => d.permission_key === permissionKey);
    return def?.default_allowed_for_consultant ?? false;
  };

  // 기본값으로 초기화
  const handleReset = async () => {
    if (!confirm("모든 권한 설정을 기본값으로 초기화하시겠습니까?")) {
      return;
    }

    setIsSaving(true);
    const result = await resetRolePermissionsAction(tenantId, "consultant");

    if (result.success) {
      setPermissions(new Map());
      showSuccess("권한 설정이 기본값으로 초기화되었습니다.");
    } else {
      showError(result.error || "초기화 실패");
    }
    setIsSaving(false);
  };

  // 카테고리별로 그룹화
  const groupedDefinitions = definitions.reduce(
    (acc, def) => {
      if (!acc[def.category]) {
        acc[def.category] = [];
      }
      acc[def.category].push(def);
      return acc;
    },
    {} as Record<string, PermissionDefinition[]>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            상담사 권한 설정
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            상담사 역할이 수행할 수 있는 작업을 설정합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={isSaving}
        >
          기본값으로 초기화
        </Button>
      </div>

      {/* 권한 목록 */}
      {Object.entries(groupedDefinitions).map(([category, defs]) => (
        <Card key={category} className="p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {defs.map((def) => {
              const isAllowed = getPermissionValue(def.permission_key as PermissionKey);
              const isCustom = permissions.has(def.permission_key);

              return (
                <div
                  key={def.permission_key}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {def.description}
                      </span>
                      {isCustom && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          사용자 정의
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {def.permission_key}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(def.permission_key as PermissionKey)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      isAllowed ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    role="switch"
                    aria-checked={isAllowed}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isAllowed ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
