import { SectionCard } from "@/components/ui/SectionCard";
import type { StudentProfile } from "@/lib/types/scoreDashboard";

interface StudentProfileCardProps {
  profile: StudentProfile;
}

export function StudentProfileCard({ profile }: StudentProfileCardProps) {
  return (
    <SectionCard
      title="학생 프로필"
      description="기본 정보 및 현재 학기"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 이름 */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500">이름</div>
          <div className="text-base font-semibold text-gray-900">
            {profile.name}
          </div>
        </div>

        {/* 학년 */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500">학년</div>
          <div className="text-base font-semibold text-gray-900">
            {profile.grade ? `${profile.grade}학년` : "N/A"}
          </div>
        </div>

        {/* 학교 유형 */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500">학교 유형</div>
          <div className="text-base font-semibold text-gray-900">
            {profile.schoolType || "N/A"}
          </div>
        </div>

        {/* 학기 정보 */}
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500">학기</div>
          <div className="text-base font-semibold text-gray-900">
            {profile.termGrade && profile.semester
              ? `${profile.termGrade}학년 ${profile.semester}학기`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* 학교 연도 */}
      {profile.schoolYear && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs text-gray-500">
            학교 연도: <span className="font-medium">{profile.schoolYear}년</span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

