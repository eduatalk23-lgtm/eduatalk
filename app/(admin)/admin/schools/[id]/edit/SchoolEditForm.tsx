"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSchool, deleteSchool } from "@/app/(admin)/actions/schoolActions";
import { useToast } from "@/components/ui/ToastProvider";
import { Dialog, DialogFooter } from "@/components/ui/Dialog";

type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  school_code?: string | null;
  region_id?: string | null;
  region: string | null;
  address?: string | null;
  postal_code?: string | null;
  address_detail?: string | null;
  city?: string | null;
  district?: string | null;
  phone?: string | null;
  category?: string | null;
  university_type?: string | null;
  university_ownership?: string | null;
  campus_name?: string | null;
};

type SchoolEditFormProps = {
  school: School;
  regions: Array<{ id: string; name: string }>;
};

export function SchoolEditForm({ school, regions }: SchoolEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [schoolType, setSchoolType] = useState<"중학교" | "고등학교" | "대학교">(school.type);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("id", school.id);

    startTransition(async () => {
      try {
        const result = await updateSchool(formData);
        if (result.success) {
          toast.showSuccess("학교 정보가 수정되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 수정에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 수정 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 수정에 실패했습니다."
        );
      }
    });
  }

  function handleDeleteClick() {
    setShowDeleteDialog(true);
  }

  function handleDeleteConfirm() {
    setShowDeleteDialog(false);
    startTransition(async () => {
      try {
        const result = await deleteSchool(school.id);
        if (result.success) {
          toast.showSuccess("학교가 삭제되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 삭제 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 삭제에 실패했습니다."
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* 학교명 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            학교명 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={school.name}
            placeholder="예: 서울대학교"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 학교 타입 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            학교 타입 <span className="text-red-500">*</span>
          </label>
          <select
            name="type"
            required
            value={schoolType}
            onChange={(e) => setSchoolType(e.target.value as "중학교" | "고등학교" | "대학교")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="중학교">중학교</option>
            <option value="고등학교">고등학교</option>
            <option value="대학교">대학교</option>
          </select>
        </div>

        {/* 지역 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            지역
          </label>
          <select
            name="region_id"
            defaultValue={school.region_id || ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>

        {/* 중복 확인 안내 */}
        <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-blue-900">
              중복 확인 안내
            </h4>
            <ul className="list-inside list-disc space-y-1 text-xs text-blue-800">
              <li>같은 학교명, 타입, 지역의 학교는 등록할 수 없습니다.</li>
              <li>
                대학교의 경우, 캠퍼스명이 다르면 같은 이름의 학교도 등록
                가능합니다.
              </li>
              <li>
                지역이 선택되지 않은 경우, 전역적으로 중복을 확인합니다.
              </li>
            </ul>
          </div>
        </div>

        {/* 기본주소 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            기본주소
          </label>
          <input
            name="address"
            defaultValue={school.address || ""}
            placeholder="예: 서울특별시 관악구 관악로 1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 우편번호 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            우편번호
          </label>
          <input
            name="postal_code"
            defaultValue={school.postal_code || ""}
            placeholder="예: 08826"
            maxLength={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 시/군/구 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            시/군/구
          </label>
          <input
            name="city"
            defaultValue={school.city || ""}
            placeholder="예: 관악구"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 상세주소 */}
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            상세주소
          </label>
          <input
            name="address_detail"
            defaultValue={school.address_detail || ""}
            placeholder="예: 서울대학교 1동 101호"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 읍/면/동 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            읍/면/동
          </label>
          <input
            name="district"
            defaultValue={school.district || ""}
            placeholder="예: 관악동"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 전화번호 */}
        <div className="flex flex-col gap-1">
          <label className="block text-sm font-medium text-gray-700">
            전화번호
          </label>
          <input
            name="phone"
            defaultValue={school.phone || ""}
            placeholder="예: 02-880-5114"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 고등학교 유형 */}
        {schoolType === "고등학교" && (
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">
              고등학교 유형
            </label>
            <select
              name="category"
              defaultValue={school.category || ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">선택하세요</option>
              <option value="일반고">일반고</option>
              <option value="특목고">특목고</option>
              <option value="자사고">자사고</option>
              <option value="특성화고">특성화고</option>
            </select>
          </div>
        )}

        {/* 대학교 유형 */}
        {schoolType === "대학교" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                대학교 유형
              </label>
              <select
                name="university_type"
                defaultValue={school.university_type || ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="4년제">4년제</option>
                <option value="2년제">2년제</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">
                설립 유형
              </label>
              <select
                name="university_ownership"
                defaultValue={school.university_ownership || ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="국립">국립</option>
                <option value="사립">사립</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                캠퍼스명
              </label>
              <input
                name="campus_name"
                defaultValue={school.campus_name || ""}
                placeholder="예: 서울캠퍼스"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isPending}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:bg-gray-100"
        >
          삭제
        </button>
        <div className="flex gap-3">
          <Link
            href="/admin/schools"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400"
          >
            {isPending ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="학교 삭제 확인"
        description={`정말로 "${school.name}" 학교를 삭제하시겠습니까?`}
        variant="destructive"
        maxWidth="md"
      >
        <div className="py-4">
          <p className="text-sm text-gray-600">
            이 작업은 되돌릴 수 없으며, 학교의 모든 정보가 삭제됩니다.
          </p>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDeleteConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-red-400"
          >
            {isPending ? "삭제 중..." : "삭제하기"}
          </button>
        </DialogFooter>
      </Dialog>
    </form>
  );
}

