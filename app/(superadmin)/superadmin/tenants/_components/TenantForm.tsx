"use client";

import { useState } from "react";

type Tenant = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

type TenantFormProps = {
  tenant?: Tenant;
  onClose: () => void;
  onSuccess: (tenant: Tenant) => void;
};

export function TenantForm({ tenant, onClose, onSuccess }: TenantFormProps) {
  const [name, setName] = useState(tenant?.name ?? "");
  const [type, setType] = useState(tenant?.type ?? "academy");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = tenant ? `/api/tenants/${tenant.id}` : "/api/tenants";
      const method = tenant ? "PUT" : "POST";

      console.log("[TenantForm] 수정 요청:", {
        url,
        method,
        tenantId: tenant?.id,
        tenant: tenant,
        name,
        type,
      });

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, type }),
      });

      const result = await response.json();

      console.log("[TenantForm] API 응답:", {
        url,
        status: response.status,
        result,
      });

      // API 응답 형식 확인: { success: true, data: ... } 또는 { success: false, error: ... }
      if (!result.success) {
        const errorMessage =
          result.error?.message || "기관 정보 저장에 실패했습니다.";
        
        // "해당 기관을 찾을 수 없습니다" 에러인 경우 추가 안내
        if (errorMessage.includes("찾을 수 없습니다")) {
          const fullMessage = `${errorMessage}\n\n페이지를 새로고침하여 최신 목록을 확인해주세요.`;
          throw new Error(fullMessage);
        }
        
        throw new Error(errorMessage);
      }

      // 성공 시 data 필드에서 tenant 정보 추출
      onSuccess(result.data);
    } catch (error) {
      console.error("[tenant] 저장 실패", error);
      const errorMessage =
        error instanceof Error ? error.message : "기관 정보 저장에 실패했습니다.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">
          {tenant ? "기관 수정" : "새 기관 추가"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">기관명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
              placeholder="예: 서울학원"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">유형</label>
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded bg-gray-100 px-4 py-2 hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

