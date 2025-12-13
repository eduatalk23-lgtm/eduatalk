import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContentMetadataTabs } from "./_components/ContentMetadataTabs";

export default function ContentMetadataPage() {
  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="콘텐츠 메타데이터 관리"
          description="개정교육과정, 학년, 학기, 교과, 과목, 플랫폼, 출판사를 관리합니다."
        />

        {/* Deprecated 경고 */}
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div className="flex-1 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-yellow-800">이 페이지는 Deprecated되었습니다</h3>
              <p className="text-sm text-yellow-700">
                일부 기능은 새로운 페이지로 이동되었습니다. 과목 관리는{" "}
                <a
                  href="/admin/subjects"
                  className="font-semibold text-yellow-800 underline hover:text-yellow-900"
                >
                  교과/과목 관리 페이지
                </a>
                에서 진행해주세요.
              </p>
            </div>
          </div>
        </div>

        <ContentMetadataTabs />
      </div>
    </PageContainer>
  );
}

