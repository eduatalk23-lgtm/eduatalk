"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyMasterToStudentContentAction } from "@/app/(student)/actions/contentMasterActions";

type CopyMasterBookButtonProps = {
  masterBookId: string;
};

export function CopyMasterBookButton({
  masterBookId,
}: CopyMasterBookButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCopy = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const result = await copyMasterToStudentContentAction(masterBookId, undefined, "book");
      const bookId = result.bookId;
      
      if (bookId) {
        setSuccess("교재를 성공적으로 가져왔습니다!");
        
        // 성공 메시지 표시 후 검색 페이지로 리다이렉트
        setTimeout(() => {
          router.push("/contents/master-books");
          router.refresh();
        }, 1500);
      } else {
        setError("교재 가져오기에 실패했습니다. 다시 시도해주세요.");
        setIsLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : "교재 가져오기에 실패했습니다. 다시 시도해주세요.";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={handleCopy}
        disabled={isLoading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400 disabled:hover:bg-indigo-400"
      >
        {isLoading ? "가져오는 중..." : "내 교재로 가져오기"}
      </button>
      
      <div className="flex flex-col gap-2">
        {success && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ✅ {success}
          </div>
        )}
        
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}

