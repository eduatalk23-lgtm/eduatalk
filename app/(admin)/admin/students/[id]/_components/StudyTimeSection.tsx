import { getStudentStudyTimeForAdmin } from "@/lib/data/admin/studentData";
import { ProgressBar } from "@/components/atoms/ProgressBar";

// 이번 주 날짜 범위 계산
function getWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export async function StudyTimeSection({ studentId }: { studentId: string }) {
  try {
    const { weekStart, weekEnd } = getWeekRange();
    const studyTime = await getStudentStudyTimeForAdmin(studentId, {
      start: weekStart,
      end: weekEnd,
    });

    const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">학습시간</h2>

        {/* 총 학습시간 */}
        <div className="flex flex-col gap-1 rounded-lg bg-indigo-50 p-4">
          <div className="text-sm text-gray-600">이번 주 총 학습시간</div>
          <div className="text-3xl font-bold text-indigo-700">
            {studyTime.totalHours}시간 {studyTime.totalMinutes % 60}분
          </div>
        </div>

        {/* 요일별 학습시간 */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700">요일별 학습시간</h3>
          <div className="flex flex-col gap-2">
            {studyTime.byDay.map((day, index) => {
              const date = new Date(day.date);
              const dayOfWeek = weekdayLabels[date.getDay()];
              return (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {day.date} ({dayOfWeek})
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {day.minutes}분
                  </span>
                </div>
              );
            })}
            {studyTime.byDay.length === 0 && (
              <p className="text-sm text-gray-500">학습 시간 데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 과목별 학습시간 */}
        {studyTime.bySubject.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700">과목별 학습시간</h3>
            <div className="flex flex-col gap-2">
              {studyTime.bySubject.slice(0, 5).map((subject, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{subject.subject}</span>
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={subject.percentage}
                      max={100}
                      color="purple"
                      size="sm"
                      className="w-24"
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {subject.minutes}분 ({subject.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 콘텐츠 타입별 학습시간 */}
        {studyTime.byContentType.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700">콘텐츠 타입별 학습시간</h3>
            <div className="flex flex-col gap-2">
              {studyTime.byContentType.map((contentType, index) => {
                const typeLabels: Record<string, string> = {
                  book: "책",
                  lecture: "강의",
                  custom: "커스텀",
                };
                return (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {typeLabels[contentType.contentType] ?? contentType.contentType}
                    </span>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={contentType.percentage}
                        max={100}
                        color="green"
                        size="sm"
                        className="w-24"
                      />
                      <span className="text-sm font-semibold text-gray-900">
                        {contentType.minutes}분 ({contentType.percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[StudyTimeSection] 학습시간 조회 실패", error);
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">학습시간 정보를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }
}

