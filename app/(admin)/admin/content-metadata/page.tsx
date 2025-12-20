import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContentMetadataTabs } from "./_components/ContentMetadataTabs";

export default function ContentMetadataPage() {
  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="콘텐츠 메타데이터 관리"
          description="플랫폼, 출판사, 진로 계열, 난이도를 관리합니다."
        />

        {/* 교과/과목 관리 안내 배너 */}
        <div className="rounded-lg border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <div className="flex items-start gap-3">
            <div className="text-indigo-600 dark:text-indigo-400 text-xl">📚</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                교과/과목 관리
              </h3>
              <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-3">
                교과와 과목 관리는 별도 페이지에서 진행해주세요.
              </p>
              <Link
                href="/admin/subjects"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                교과/과목 관리 페이지로 이동
                <span className="text-base">→</span>
              </Link>
            </div>
          </div>
        </div>

        <ContentMetadataTabs />
      </div>
    </PageContainer>
  );
}

