"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { QuickCreateModal } from "./QuickCreateModal";

/**
 * 빠른 플랜 생성 버튼
 *
 * 클릭 시 QuickCreateModal을 열어
 * 콘텐츠 우선 접근법으로 빠르게 플랜을 생성합니다.
 */
export function QuickCreateButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
        aria-label="빠른 플랜 생성"
      >
        <Zap className="h-4 w-4" />
        빠른 생성
      </button>

      <QuickCreateModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
