"use client";

/**
 * 파트너 목록 컴포넌트
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  togglePartnerActive,
  deletePartner,
  type ContentPartner,
} from "@/lib/domains/content-research/actions/partners";
import Button from "@/components/atoms/Button";

interface PartnersListProps {
  partners: ContentPartner[];
}

export function PartnersList({ partners }: PartnersListProps) {
  const router = useRouter();
  const toast = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggleActive = async (partner: ContentPartner) => {
    setLoadingId(partner.id);
    try {
      const result = await togglePartnerActive(partner.id);
      if (result.success) {
        toast.showSuccess(
          result.is_active ? "파트너가 활성화되었습니다." : "파트너가 비활성화되었습니다."
        );
        router.refresh();
      } else {
        toast.showError(result.error ?? "상태 변경 실패");
      }
    } catch (error) {
      toast.showError("상태 변경 중 오류가 발생했습니다.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (partner: ContentPartner) => {
    if (!confirm(`"${partner.display_name}" 파트너를 삭제하시겠습니까?`)) {
      return;
    }

    setLoadingId(partner.id);
    try {
      const result = await deletePartner(partner.id);
      if (result.success) {
        toast.showSuccess("파트너가 삭제되었습니다.");
        router.refresh();
      } else {
        toast.showError(result.error ?? "삭제 실패");
      }
    } catch (error) {
      toast.showError("삭제 중 오류가 발생했습니다.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              파트너
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              유형
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              콘텐츠
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              상태
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              동기화
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              작업
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {partners.map((partner) => (
            <tr key={partner.id} className="hover:bg-gray-50">
              <td className="px-4 py-4">
                <div>
                  <p className="font-medium text-gray-900">{partner.display_name}</p>
                  <p className="text-sm text-gray-500">{partner.name}</p>
                </div>
              </td>
              <td className="px-4 py-4">
                <PartnerTypeBadge type={partner.partner_type} />
              </td>
              <td className="px-4 py-4">
                <ContentTypeBadge type={partner.content_type} />
              </td>
              <td className="px-4 py-4">
                <StatusBadge isActive={partner.is_active} />
              </td>
              <td className="px-4 py-4">
                <SyncStatusBadge status={partner.sync_status} lastSync={partner.last_sync_at} />
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(partner)}
                    disabled={loadingId === partner.id}
                  >
                    {partner.is_active ? "비활성화" : "활성화"}
                  </Button>
                  <Link href={`/admin/content-management/partners/${partner.id}`}>
                    <Button variant="outline" size="sm">
                      상세
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(partner)}
                    disabled={loadingId === partner.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    삭제
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    publisher: "bg-blue-100 text-blue-800",
    lecture_platform: "bg-purple-100 text-purple-800",
    academy: "bg-green-100 text-green-800",
  };

  const labels: Record<string, string> = {
    publisher: "출판사",
    lecture_platform: "강의 플랫폼",
    academy: "학원",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || "bg-gray-100 text-gray-800"}`}>
      {labels[type] || type}
    </span>
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    book: "📚 교재",
    lecture: "🎬 강의",
    both: "📚🎬 모두",
  };

  return <span className="text-sm">{labels[type] || type}</span>;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-800"
      }`}
    >
      {isActive ? "활성" : "비활성"}
    </span>
  );
}

function SyncStatusBadge({ status, lastSync }: { status: string; lastSync?: string }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    syncing: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
  };

  const labels: Record<string, string> = {
    pending: "대기",
    syncing: "동기화 중",
    completed: "완료",
    error: "오류",
  };

  return (
    <div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
      {lastSync && (
        <p className="text-xs text-gray-400 mt-1">
          {new Date(lastSync).toLocaleDateString("ko-KR")}
        </p>
      )}
    </div>
  );
}
