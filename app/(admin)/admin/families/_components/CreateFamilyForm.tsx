"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFamilyGroup } from "@/lib/domains/family";
import { useToast } from "@/components/ui/ToastProvider";

export function CreateFamilyForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [familyName, setFamilyName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await createFamilyGroup({
        familyName: familyName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success && result.data) {
        showToast("가족이 생성되었습니다.", "success");
        router.push(`/admin/families/${result.data.familyId}`);
      } else {
        showToast(result.error || "가족 생성에 실패했습니다.", "error");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-6">
          {/* Family Name */}
          <div>
            <label
              htmlFor="familyName"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              가족 이름
            </label>
            <input
              type="text"
              id="familyName"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="예: 김씨 가족"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              비워두면 나중에 설정할 수 있습니다
            </p>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              메모 (선택)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="가족에 대한 메모를 입력하세요"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Info */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              가족을 생성한 후 학생과 학부모를 추가할 수 있습니다. 학생 상세 페이지나 학부모 연결
              승인 시 자동으로 가족에 추가되기도 합니다.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "생성 중..." : "가족 생성"}
          </button>
        </div>
      </div>
    </form>
  );
}
