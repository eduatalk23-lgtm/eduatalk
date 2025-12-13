"use client";

import { useState } from "react";
import { TenantForm } from "./TenantForm";

type Tenant = {
  id: string;
  name: string;
  type: string;
  status?: string | null;
  created_at: string;
  updated_at: string;
};

type TenantCardProps = {
  tenant: Tenant;
  onUpdate: (tenant: Tenant) => void;
  onDelete: (tenantId: string) => void;
};

export function TenantCard({ tenant, onUpdate, onDelete }: TenantCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`정말 "${tenant.name}" 기관을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("삭제 실패");
      }

      onDelete(tenant.id);
    } catch (error) {
      console.error("[tenant] 삭제 실패", error);
      alert("기관 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isEditing) {
    return (
      <TenantForm
        tenant={tenant}
        onClose={() => setIsEditing(false)}
        onSuccess={(updated) => {
          onUpdate(updated);
          setIsEditing(false);
        }}
      />
    );
  }

  const statusLabel = tenant.status === "active" ? "활성" : tenant.status === "inactive" ? "비활성" : tenant.status === "suspended" ? "정지" : "활성";
  const statusColor = tenant.status === "active" ? "bg-green-100 text-green-800" : tenant.status === "inactive" ? "bg-gray-100 text-gray-800" : tenant.status === "suspended" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{tenant.name}</h3>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          유형: {tenant.type === "academy" ? "학원" : tenant.type === "school" ? "학교" : tenant.type === "enterprise" ? "기업" : "기타"}
        </p>
      </div>

      <div className="text-xs text-gray-400">
        <p>생성일: {new Date(tenant.created_at).toLocaleDateString("ko-KR")}</p>
        <p>수정일: {new Date(tenant.updated_at).toLocaleDateString("ko-KR")}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
        >
          수정
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1 rounded bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
        >
          {isDeleting ? "삭제 중..." : "삭제"}
        </button>
      </div>
    </div>
  );
}

