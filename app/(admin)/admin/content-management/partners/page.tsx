/**
 * 콘텐츠 파트너 관리 페이지
 *
 * B2B 파트너십 (출판사, 강의 플랫폼) 목록 및 관리
 */

import Link from "next/link";
import { getPartners } from "@/lib/domains/content-research/actions/partners";
import { PartnersList } from "./_components/PartnersList";
import { AddPartnerButton } from "./_components/AddPartnerButton";

export const metadata = {
  title: "콘텐츠 파트너 관리",
  description: "B2B 파트너십 관리 (출판사, 강의 플랫폼)",
};

export default async function PartnersPage() {
  const result = await getPartners();
  const partners = result.success ? result.partners ?? [] : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/content-management" className="hover:text-gray-700">
            콘텐츠 관리
          </Link>
          <span>/</span>
          <span>파트너 관리</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">콘텐츠 파트너 관리</h1>
            <p className="text-gray-600 mt-1">
              출판사, 강의 플랫폼과의 B2B 파트너십을 관리합니다.
            </p>
          </div>
          <AddPartnerButton />
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-xl">🤝</span>
          <div>
            <p className="font-medium text-purple-800">B2B 파트너십 (Tier 3)</p>
            <p className="text-sm text-purple-700 mt-1">
              출판사나 강의 플랫폼과 계약을 체결하면 콘텐츠 카탈로그를 자동으로 동기화할 수 있습니다.
              현재는 파트너 정보 등록 기능만 제공됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 파트너 목록 */}
      {!result.success ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">파트너 목록을 불러오는데 실패했습니다: {result.error}</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4">등록된 파트너가 없습니다.</p>
          <p className="text-sm text-gray-400">
            &quot;파트너 추가&quot; 버튼을 눌러 첫 번째 파트너를 등록하세요.
          </p>
        </div>
      ) : (
        <PartnersList partners={partners} />
      )}
    </div>
  );
}
