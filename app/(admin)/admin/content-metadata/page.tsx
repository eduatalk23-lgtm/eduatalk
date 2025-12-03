import { ContentMetadataTabs } from "./_components/ContentMetadataTabs";

export default function ContentMetadataPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900">콘텐츠 메타데이터 관리</h1>
        <p className="mt-2 text-sm text-gray-700">
          개정교육과정, 학년, 학기, 교과, 과목, 플랫폼, 출판사를 관리합니다.
        </p>
      </div>

      <ContentMetadataTabs />
    </div>
  );
}

