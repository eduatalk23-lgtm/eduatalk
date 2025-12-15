"use client";

import { useState } from "react";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteSchool } from "@/app/(admin)/actions/schoolActions";
import type { School } from "@/lib/data/schools";

type SchoolTableProps = {
  schools: School[];
  onEdit: (school: School) => void;
  onRefresh: () => void;
};

export default function SchoolTable({
  schools,
  onEdit,
  onRefresh,
}: SchoolTableProps) {
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);

  function handleDeleteClick(school: School) {
    setSchoolToDelete(school);
    setShowDeleteDialog(true);
  }

  function handleDeleteConfirm() {
    if (!schoolToDelete) return;

    setShowDeleteDialog(false);
    setDeletingId(schoolToDelete.id);

    deleteSchool(schoolToDelete.id)
      .then((result) => {
        if (result.success) {
          toast.showSuccess("학교가 삭제되었습니다.");
          onRefresh();
        } else {
          toast.showError(result.error || "학교 삭제에 실패했습니다.");
        }
      })
      .catch((error) => {
        console.error("학교 삭제 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 삭제에 실패했습니다."
        );
      })
      .finally(() => {
        setDeletingId(null);
        setSchoolToDelete(null);
      });
  }

  // 타입별 속성 표시 텍스트 생성
  function getTypeAttribute(school: School): string {
    if (school.type === "고등학교" && school.category) {
      return school.category;
    } else if (school.type === "대학교") {
      const parts: string[] = [];
      if (school.university_type) parts.push(school.university_type);
      if (school.university_ownership) parts.push(school.university_ownership);
      return parts.length > 0 ? parts.join("/") : "—";
    }
    return "—";
  }

  if (schools.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-600 dark:bg-gray-800">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="text-6xl">🏫</div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              검색 결과가 없습니다
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              다른 검색 조건으로 시도해보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                순서
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                학교명
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                타입
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                유형
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                지역
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                주소
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                전화번호
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                등록일
              </th>
              <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school, index) => (
              <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {index + 1}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900 dark:border-gray-700 dark:text-gray-100">
                  {school.name}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {school.type}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {getTypeAttribute(school)}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {school.region || "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {school.address || "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {school.phone || "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  {school.created_at
                    ? new Date(school.created_at).toLocaleDateString("ko-KR")
                    : "—"}
                </td>
                <td className="border-b border-gray-100 px-4 py-3 text-sm dark:border-gray-700">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(school)}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(school)}
                      disabled={deletingId === school.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteDialog && schoolToDelete && (
        <Dialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="학교 삭제 확인"
          description={`정말로 "${schoolToDelete.name}" 학교를 삭제하시겠습니까?`}
          variant="destructive"
          maxWidth="md"
        >
          <div className="py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              이 작업은 되돌릴 수 없으며, 학교의 모든 정보가 삭제됩니다.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deletingId === schoolToDelete.id}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-red-400"
            >
              {deletingId === schoolToDelete.id ? "삭제 중..." : "삭제하기"}
            </button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}

