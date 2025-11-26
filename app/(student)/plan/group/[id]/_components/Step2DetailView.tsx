import type { PlanGroup, PlanExclusion, AcademySchedule } from "@/lib/types/plan";

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

type Step2DetailViewProps = {
  group: PlanGroup;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  templateBlocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  templateBlockSetName?: string | null;
};

export function Step2DetailView({ 
  group, 
  exclusions, 
  academySchedules,
  templateBlocks = [],
  templateBlockSetName = null,
}: Step2DetailViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">블록 및 제외일</h2>
        <p className="mt-1 text-sm text-gray-500">
          학습 시간 블록과 제외일, 학원 일정을 확인할 수 있습니다.
        </p>
      </div>

      {/* 블록 세트 정보 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">블록 세트</h3>
        {templateBlockSetName ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900">
              {templateBlockSetName}
            </p>
            {templateBlocks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">시간 블록</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {templateBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {weekdayLabels[block.day_of_week]}
                      </div>
                      <div className="text-xs text-gray-600">
                        {block.start_time} ~ {block.end_time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">등록된 시간 블록이 없습니다.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            {group.block_set_id ? "블록 세트가 설정되었습니다." : "블록 세트가 설정되지 않았습니다."}
          </p>
        )}
      </div>

      {/* 학습 제외일 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">학습 제외일</h3>
        {exclusions.length > 0 ? (
          <div className="space-y-2">
            {exclusions.map((exclusion) => (
              <div
                key={exclusion.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(exclusion.exclusion_date).toLocaleDateString("ko-KR")}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>{exclusion.exclusion_type}</span>
                    {exclusion.reason && <span>· {exclusion.reason}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">등록된 제외일이 없습니다.</p>
        )}
      </div>

      {/* 학원 일정 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">학원 일정</h3>
        {academySchedules.length > 0 ? (
          <div className="space-y-2">
            {academySchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {weekdayLabels[schedule.day_of_week]} {schedule.start_time} ~ {schedule.end_time}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {schedule.academy_name && <span>{schedule.academy_name}</span>}
                    {schedule.subject && (
                      <>
                        {schedule.academy_name && <span>·</span>}
                        <span>{schedule.subject}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">등록된 학원 일정이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

