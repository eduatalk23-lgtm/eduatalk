"use client";

import { useState } from "react";

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
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">기관 정보</h2>

        {message && (
          <div
            className={`mb-4 rounded-lg p-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

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
    </div>
  );
}

