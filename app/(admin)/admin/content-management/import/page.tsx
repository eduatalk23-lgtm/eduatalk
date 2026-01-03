/**
 * 콘텐츠 벌크 Import 페이지
 *
 * Excel 파일 업로드 → 검증 → AI 추천 → Import
 */

import { Suspense } from "react";
import Link from "next/link";
import { ImportWizard } from "./_components/ImportWizard";

export const metadata = {
  title: "콘텐츠 일괄 등록",
  description: "Excel 파일로 콘텐츠를 일괄 등록합니다.",
};

export default function ContentImportPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/content-management" className="hover:text-gray-700">
            콘텐츠 관리
          </Link>
          <span>/</span>
          <span>일괄 등록</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">콘텐츠 일괄 등록</h1>
        <p className="text-gray-600 mt-1">
          Excel 파일을 업로드하여 여러 교재/강의를 한 번에 등록합니다.
        </p>
      </div>

      {/* 가이드 배너 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-xl">📋</span>
          <div>
            <p className="font-medium text-blue-800">일괄 등록 프로세스</p>
            <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
              <li>Excel 파일 업로드 (템플릿 다운로드 권장)</li>
              <li>필수 필드 자동 검증</li>
              <li>누락된 필드는 AI가 추정값 제안</li>
              <li>검토 후 최종 등록</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Import Wizard */}
      <Suspense fallback={<div className="text-center py-8">로딩 중...</div>}>
        <ImportWizard />
      </Suspense>
    </div>
  );
}
