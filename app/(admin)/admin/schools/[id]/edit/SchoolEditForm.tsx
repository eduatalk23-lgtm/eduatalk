"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSchool, deleteSchool } from "@/app/(admin)/actions/schoolActions";

type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  region: string | null;
  address: string | null;
};

export function SchoolEditForm({ school }: { school: School }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("id", school.id);

    startTransition(async () => {
      try {
        const result = await updateSchool(formData);
        if (result.success) {
          router.push("/admin/schools");
        } else {
          alert(result.error || "학교 수정에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 수정 실패:", error);
        alert(
          error instanceof Error ? error.message : "학교 수정에 실패했습니다."
        );
      }
    });
  }

  function handleDelete() {
    if (!confirm("정말로 이 학교를 삭제하시겠습니까?")) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteSchool(school.id);
        if (result.success) {
          router.push("/admin/schools");
        } else {
          alert(result.error || "학교 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 삭제 실패:", error);
        alert(
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
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
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
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            학교 타입 <span className="text-red-500">*</span>
          </label>
          <select
            name="type"
            required
            defaultValue={school.type}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="중학교">중학교</option>
            <option value="고등학교">고등학교</option>
            <option value="대학교">대학교</option>
          </select>
        </div>

        {/* 지역 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            지역
          </label>
          <input
            name="region"
            defaultValue={school.region || ""}
            placeholder="예: 서울, 경기, 부산"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 주소 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            주소
          </label>
          <input
            name="address"
            defaultValue={school.address || ""}
            placeholder="예: 서울특별시 관악구 관악로 1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleDelete}
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
    </form>
  );
}

