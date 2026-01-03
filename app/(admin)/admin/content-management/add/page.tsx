/**
 * 간편 콘텐츠 등록 페이지
 *
 * AI 메타데이터 추출을 활용한 빠른 콘텐츠 등록
 */

import Link from "next/link";
import { QuickBookForm } from "./_components/QuickBookForm";
import { getPublishers } from "@/lib/data/contentMetadata";

export const metadata = {
  title: "간편 콘텐츠 등록",
  description: "AI를 활용한 빠른 콘텐츠 등록",
};

export default async function QuickAddContentPage() {
  const publishers = await getPublishers();

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/master-books" className="hover:text-blue-600">
            교재 관리
          </Link>
          <span>/</span>
          <span className="text-gray-900">간편 등록</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">간편 콘텐츠 등록</h1>
        <p className="text-gray-600 mt-1">
          교재명을 입력하면 AI가 과목, 난이도, 교육과정을 자동으로 추론합니다.
        </p>
      </div>

      {/* 탭 (향후 확장: 도서/강의 전환) */}
      <div className="flex gap-2 mb-6">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          도서 등록
        </button>
        <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
          강의 등록 (준비중)
        </button>
      </div>

      {/* 폼 */}
      <QuickBookForm publishers={publishers} />
    </div>
  );
}
