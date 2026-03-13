/**
 * 콘텐츠 관리 대시보드
 */

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export const metadata = {
  title: "콘텐츠 관리",
  description: "마스터 콘텐츠 관리 대시보드",
};

export default async function ContentManagementPage() {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId;

  // 통계 조회
  const [booksResult, lecturesResult] = await Promise.all([
    supabase
      .from("master_books")
      .select("id, estimated_hours", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("master_lectures")
      .select("id, estimated_hours", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  const bookCount = booksResult.count ?? 0;
  const lectureCount = lecturesResult.count ?? 0;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">콘텐츠 관리</h1>
          <p className="text-gray-600 mt-1">마스터 교재 및 강의를 관리합니다.</p>
        </div>
        <Link
          href="/admin/content-management/add"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          간편 등록
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="등록된 교재"
          value={bookCount}
          icon="📚"
          link="/admin/master-books"
        />
        <StatCard
          title="등록된 강의"
          value={lectureCount}
          icon="🎬"
          link="/admin/master-lectures"
        />
        <StatCard
          title="총 콘텐츠"
          value={bookCount + lectureCount}
          icon="📦"
        />
        <StatCard
          title="이번 달 등록"
          value="-"
          icon="📈"
          description="곧 지원 예정"
        />
      </div>

      {/* 빠른 작업 */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">빠른 작업</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title="AI 간편 등록"
            description="제목만 입력하면 AI가 메타데이터를 자동 추론"
            icon="✨"
            href="/admin/content-management/add"
            primary
          />
          <QuickActionCard
            title="일괄 등록 (AI 검증)"
            description="Excel 업로드 + AI가 누락 필드 추정"
            icon="🤖"
            href="/admin/content-management/import"
            primary
          />
          <QuickActionCard
            title="교재 관리"
            description="등록된 교재 목록 조회 및 수정"
            icon="📚"
            href="/admin/master-books"
          />
          <QuickActionCard
            title="강의 관리"
            description="등록된 강의 목록 조회 및 수정"
            icon="🎬"
            href="/admin/master-lectures"
          />
        </div>
      </div>

      {/* B2B 파트너십 */}
      <div className="bg-white rounded-lg border shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">B2B 파트너십</h2>
          <Link
            href="/admin/content-management/partners"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            전체 보기 →
          </Link>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">🤝</span>
            <div>
              <p className="font-medium text-purple-800">콘텐츠 파트너 관리</p>
              <p className="text-sm text-purple-700 mt-1">
                출판사, 강의 플랫폼과 계약하여 콘텐츠를 자동으로 동기화합니다.
              </p>
              <Link
                href="/admin/content-management/partners"
                className="inline-block mt-2 text-sm font-medium text-purple-800 hover:text-purple-900"
              >
                파트너 관리 →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 등록 (향후 구현) */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">최근 등록된 콘텐츠</h2>
        <p className="text-gray-500 text-sm">곧 지원 예정입니다.</p>
      </div>
    </div>
  );
}

// ============================================
// 서브 컴포넌트
// ============================================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  link?: string;
  description?: string;
}

function StatCard({ title, value, icon, link, description }: StatCardProps) {
  const content = (
    <div className="bg-white rounded-lg border shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          )}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  primary?: boolean;
}

function QuickActionCard({ title, description, icon, href, primary }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className={`block p-4 rounded-lg border transition-all ${
        primary
          ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className={`font-medium ${primary ? "text-blue-900" : "text-gray-900"}`}>
            {title}
          </h3>
          <p className={`text-sm mt-1 ${primary ? "text-blue-700" : "text-gray-600"}`}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
