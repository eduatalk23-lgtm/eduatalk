"use client";

import { useState } from "react";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteSchool } from "@/app/(admin)/actions/schoolActions";
import type { School } from "@/lib/data/schools";
import { 
  bgSurface, 
  bgPage, 
  bgHover,
  borderDefault, 
  borderInput,
  textPrimary, 
  textSecondary,
  textTertiary,
  textMuted,
  tableHeaderBase,
  tableCellBase,
  getGrayBgClasses,
  getIndigoTextClasses,
  getRedTextClasses,
  getRedBgClasses,
  tableRowHover,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

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
      <div className={cn("rounded-xl border border-dashed p-12 text-center", borderInput, bgPage)}>
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="text-6xl">🏫</div>
          <div className="flex flex-col gap-2">
            <h3 className={cn("text-lg font-semibold", textPrimary)}>
              검색 결과가 없습니다
            </h3>
            <p className={cn("text-sm", textSecondary)}>
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
        <table className={cn("w-full border-collapse rounded-lg border", borderDefault, bgSurface)}>
          <thead className={cn(getGrayBgClasses("tableHeader"))}>
            <tr>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, textPrimary)}>
                순서
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                학교명
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                타입
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                유형
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                지역
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                주소
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                전화번호
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                등록일
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school, index) => (
              <tr key={school.id} className={cn("transition-colors", tableRowHover)}>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {index + 1}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm font-medium", borderDefault, tableCellBase, textPrimary)}>
                  {school.name}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.type}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {getTypeAttribute(school)}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.region || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.address || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.phone || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.created_at
                    ? new Date(school.created_at).toLocaleDateString("ko-KR")
                    : "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase)}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(school)}
                      className={getIndigoTextClasses("link")}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(school)}
                      disabled={deletingId === school.id}
                      className={cn("disabled:opacity-50", getRedTextClasses("link"))}
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
            <p className={cn("text-sm", textTertiary)}>
              이 작업은 되돌릴 수 없으며, 학교의 모든 정보가 삭제됩니다.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className={cn("rounded-lg border px-4 py-2 text-sm font-semibold transition", borderInput, bgSurface, textSecondary, bgHover)}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deletingId === schoolToDelete.id}
              className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition", getRedBgClasses("danger"))}
            >
              {deletingId === schoolToDelete.id ? "삭제 중..." : "삭제하기"}
            </button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}

