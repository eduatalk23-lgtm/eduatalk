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
          description="플랫폼, 출판사, 진로 계열, 난이도를 관리합니다. 교과/과목 관리는 교과/과목 관리 페이지에서 진행해주세요."
        />

        <ContentMetadataTabs />
      </div>
    </PageContainer>
  );
}

