"use client";

import { useState, useEffect } from "react";
import {
  getAutoApproveSettings,
  updateAutoApproveSettings,
  type AutoApproveSettings,
  type ParentRelation,
} from "@/lib/domains/tenant";

type Tenant = {
  id: string;
  name: string;
  type: string;
};

type TenantSettingsFormProps = {
  tenant: Tenant;
  stats: {
    students: number;
    parents: number;
    admins: number;
  };
};

export function TenantSettingsForm({ tenant, stats }: TenantSettingsFormProps) {
  const [name, setName] = useState(tenant.name);
  const [type, setType] = useState(tenant.type);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 자동 승인 설정 상태
  const [autoApproveSettings, setAutoApproveSettings] = useState<AutoApproveSettings>({
    enabled: false,
    conditions: {
      sameTenantOnly: true,
      allowedRelations: ["father", "mother"],
    },
  });
  const [isLoadingAutoApprove, setIsLoadingAutoApprove] = useState(true);
  const [isSavingAutoApprove, setIsSavingAutoApprove] = useState(false);
  const [autoApproveMessage, setAutoApproveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 자동 승인 설정 로드
  useEffect(() => {
    async function loadAutoApproveSettings() {
      setIsLoadingAutoApprove(true);
      const result = await getAutoApproveSettings(tenant.id);

      if (result.success && result.data) {
        setAutoApproveSettings(result.data);
      } else {
        setAutoApproveMessage({
          type: "error",
          text: result.error || "자동 승인 설정을 불러올 수 없습니다.",
        });
      }
      setIsLoadingAutoApprove(false);
    }

    loadAutoApproveSettings();
  }, [tenant.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, type }),
      });

      if (!response.ok) {
        throw new Error("저장 실패");
      }

      setMessage({ type: "success", text: "기관 정보가 저장되었습니다." });
    } catch (error) {
      console.error("[tenant] 저장 실패", error);
      setMessage({ type: "error", text: "기관 정보 저장에 실패했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 자동 승인 설정 저장
  const handleSaveAutoApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAutoApprove(true);
    setAutoApproveMessage(null);

    try {
      const result = await updateAutoApproveSettings(
        autoApproveSettings,
        tenant.id
      );

      if (result.success) {
        setAutoApproveMessage({
          type: "success",
          text: "자동 승인 설정이 저장되었습니다.",
        });
      } else {
        setAutoApproveMessage({
          type: "error",
          text: result.error || "자동 승인 설정 저장에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("[tenant] 자동 승인 설정 저장 실패", error);
      setAutoApproveMessage({
        type: "error",
        text: "자동 승인 설정 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSavingAutoApprove(false);
    }
  };

  // 관계 선택 토글
  const toggleRelation = (relation: ParentRelation) => {
    setAutoApproveSettings((prev) => {
      const relations = prev.conditions.allowedRelations;
      const newRelations = relations.includes(relation)
        ? relations.filter((r) => r !== relation)
        : [...relations, relation];

      return {
        ...prev,
        conditions: {
          ...prev.conditions,
          allowedRelations: newRelations,
        },
      };
    });
  };

  const relationLabels: Record<ParentRelation, string> = {
    father: "아버지",
    mother: "어머니",
    guardian: "보호자",
    other: "기타",
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">학생 수</div>
          <div className="text-2xl font-semibold">{stats.students}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">학부모 수</div>
          <div className="text-2xl font-semibold">{stats.parents}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">관리자 수</div>
          <div className="text-2xl font-semibold">{stats.admins}</div>
        </div>
      </div>

      {/* 기관 정보 수정 폼 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-semibold">기관 정보</h2>

        {message && (
          <div
            className={`rounded-lg p-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium">기관명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
              placeholder="예: 서울학원"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium">유형</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="academy">학원</option>
              <option value="school">학교</option>
              <option value="enterprise">기업</option>
              <option value="other">기타</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>

      {/* 자동 승인 설정 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">학부모 연결 자동 승인</h2>
          <p className="text-sm text-gray-600">
            조건을 만족하는 연결 요청을 자동으로 승인할 수 있습니다.
          </p>
        </div>

        {autoApproveMessage && (
          <div
            className={`rounded-lg p-3 ${
              autoApproveMessage.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {autoApproveMessage.text}
          </div>
        )}

        {isLoadingAutoApprove ? (
          <div className="py-4 text-center text-sm text-gray-500">
            설정을 불러오는 중...
          </div>
        ) : (
          <form onSubmit={handleSaveAutoApprove} className="space-y-4">
            {/* 자동 승인 활성화 토글 */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autoApproveEnabled"
                checked={autoApproveSettings.enabled}
                onChange={(e) =>
                  setAutoApproveSettings((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="autoApproveEnabled"
                className="text-sm font-medium text-gray-900"
              >
                자동 승인 활성화
              </label>
            </div>

            {/* 조건 설정 (활성화 시에만 표시) */}
            {autoApproveSettings.enabled && (
              <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                {/* 같은 테넌트만 체크박스 */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="sameTenantOnly"
                    checked={autoApproveSettings.conditions.sameTenantOnly}
                    onChange={(e) =>
                      setAutoApproveSettings((prev) => ({
                        ...prev,
                        conditions: {
                          ...prev.conditions,
                          sameTenantOnly: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="sameTenantOnly"
                    className="text-sm font-medium text-gray-900"
                  >
                    같은 테넌트 내에서만 자동 승인
                  </label>
                </div>

                {/* 관계 선택 다중 선택 */}
                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-900">
                    자동 승인할 관계 선택
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {(
                      ["father", "mother", "guardian", "other"] as ParentRelation[]
                    ).map((relation) => (
                      <label
                        key={relation}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 transition hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={autoApproveSettings.conditions.allowedRelations.includes(
                            relation
                          )}
                          onChange={() => toggleRelation(relation)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">
                          {relationLabels[relation]}
                        </span>
                      </label>
                    ))}
                  </div>
                  {autoApproveSettings.conditions.allowedRelations.length ===
                    0 && (
                    <p className="text-xs text-red-600">
                      최소 하나 이상의 관계를 선택해야 합니다.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  isSavingAutoApprove ||
                  autoApproveSettings.conditions.allowedRelations.length === 0
                }
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingAutoApprove ? "저장 중..." : "설정 저장"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

