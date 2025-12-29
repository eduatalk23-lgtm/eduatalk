"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, BookPlus, Calendar, HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { QuickCreateModal } from "./QuickCreateModal";

/**
 * 플랜 액션 버튼 그룹
 *
 * 세 가지 플랜 생성 방법에 대한 설명과 함께 버튼을 제공합니다:
 * 1. 콘텐츠 추가 - 기존 플랜에 콘텐츠 연결
 * 2. 빠른 생성 - 콘텐츠 우선 간단 플랜 생성
 * 3. 플랜 생성 - 전체 위저드로 상세 플랜 생성
 */
export function PlanActionButtons() {
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 도움말 버튼 */}
        <Tooltip
          content={
            <div className="space-y-2 min-w-[200px]">
              <p className="font-medium text-white">플랜 생성 방법</p>
              <ul className="space-y-1.5 text-gray-300 text-xs">
                <li className="flex items-start gap-1.5">
                  <span className="text-orange-400 mt-0.5">•</span>
                  <span><strong className="text-white">콘텐츠</strong>: 기존 플랜에 교재/강의 연결</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span><strong className="text-white">빠른 생성</strong>: 콘텐츠 선택 후 간단 설정</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span><strong className="text-white">플랜 생성</strong>: 전체 위저드로 상세 설정</span>
                </li>
              </ul>
            </div>
          }
          position="bottom"
        >
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="플랜 생성 도움말"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </Tooltip>

        {/* 콘텐츠 추가 버튼 */}
        <Tooltip
          content={
            <div className="space-y-1">
              <p className="font-medium">콘텐츠 추가</p>
              <p className="text-xs text-gray-300">기존 플랜 그룹에 교재나 강의를 연결합니다.</p>
            </div>
          }
          position="bottom"
        >
          <Link
            href="/plan/content-add"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-600 bg-white px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
            aria-label="콘텐츠 추가"
          >
            <BookPlus className="h-4 w-4" />
            <span className="hidden sm:inline">+ 콘텐츠</span>
            <span className="sm:hidden">+</span>
          </Link>
        </Tooltip>

        {/* 빠른 생성 버튼 */}
        <Tooltip
          content={
            <div className="space-y-1">
              <p className="font-medium">빠른 플랜 생성</p>
              <p className="text-xs text-gray-300">콘텐츠를 선택하고 간단한 설정으로 바로 플랜을 생성합니다.</p>
              <p className="text-xs text-purple-300 mt-1">⚡ 약 1분 소요</p>
            </div>
          }
          position="bottom"
        >
          <button
            onClick={() => setIsQuickCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            aria-label="빠른 플랜 생성"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">빠른 생성</span>
            <span className="sm:hidden">⚡</span>
          </button>
        </Tooltip>

        {/* 플랜 생성 (전체 위저드) */}
        <Tooltip
          content={
            <div className="space-y-1">
              <p className="font-medium">전체 플랜 생성 위저드</p>
              <p className="text-xs text-gray-300">기간, 요일, 콘텐츠, 일정을 상세하게 설정합니다.</p>
              <p className="text-xs text-indigo-300 mt-1">📋 약 3-5분 소요</p>
            </div>
          }
          position="bottom"
        >
          <Link
            href="/plan/new-group"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            aria-label="새 플랜 그룹 생성"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">+ 플랜 생성</span>
            <span className="sm:hidden">+</span>
          </Link>
        </Tooltip>
      </div>

      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
      />
    </>
  );
}
