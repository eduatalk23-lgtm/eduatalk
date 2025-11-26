"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSchool } from "@/app/(admin)/actions/schoolActions";
import { getRegions } from "@/lib/data/schools";
import { useToast } from "@/components/ui/ToastProvider";

type SchoolFormProps = {
  regions: Array<{ id: string; name: string }>;
};

export function SchoolForm({ regions }: SchoolFormProps) {
  const [isPending, startTransition] = useTransition();
  const [schoolType, setSchoolType] = useState<"중학교" | "고등학교" | "대학교" | "">("");
  const router = useRouter();
  const toast = useToast();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const result = await createSchool(formData);
        if (result.success) {
          toast.showSuccess("학교가 등록되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 등록에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 등록 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 등록에 실패했습니다."
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
            value={schoolType}
            onChange={(e) => setSchoolType(e.target.value as "중학교" | "고등학교" | "대학교" | "")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
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
          <select
            name="region_id"
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
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            기본주소
          </label>
          <input
            name="address"
            placeholder="예: 서울특별시 관악구 관악로 1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 우편번호 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            우편번호
          </label>
          <input
            name="postal_code"
            placeholder="예: 08826"
            maxLength={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 시/군/구 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            시/군/구
          </label>
          <input
            name="city"
            placeholder="예: 관악구"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 상세주소 */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            상세주소
          </label>
          <input
            name="address_detail"
            placeholder="예: 서울대학교 1동 101호"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 읍/면/동 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            읍/면/동
          </label>
          <input
            name="district"
            placeholder="예: 관악동"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            전화번호
          </label>
          <input
            name="phone"
            placeholder="예: 02-880-5114"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 고등학교 유형 */}
        {schoolType === "고등학교" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              고등학교 유형
            </label>
            <select
              name="category"
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                대학교 유형
              </label>
              <select
                name="university_type"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="4년제">4년제</option>
                <option value="2년제">2년제</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                설립 유형
              </label>
              <select
                name="university_ownership"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">선택하세요</option>
                <option value="국립">국립</option>
                <option value="사립">사립</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                캠퍼스명
              </label>
              <input
                name="campus_name"
                placeholder="예: 서울캠퍼스"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3">
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
          {isPending ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </form>
  );
}

