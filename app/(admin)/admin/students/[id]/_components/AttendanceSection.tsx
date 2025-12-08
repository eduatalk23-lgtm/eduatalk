import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAttendanceByStudent,
  calculateAttendanceStats,
} from "@/lib/domains/attendance/service";
import { AttendanceRecordForm } from "@/app/(admin)/admin/attendance/_components/AttendanceRecordForm";
import { AttendanceList } from "@/app/(admin)/admin/attendance/_components/AttendanceList";
import { AttendanceStatistics } from "@/app/(admin)/admin/attendance/_components/AttendanceStatistics";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function AttendanceSection({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  // 이번 달 날짜 범위
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const startDate = monthStart.toISOString().slice(0, 10);
  const endDate = monthEnd.toISOString().slice(0, 10);

  // 출석 기록 조회
  const records = await getAttendanceByStudent(studentId, startDate, endDate);

  // 출석 통계 계산
  const stats = await calculateAttendanceStats(studentId, startDate, endDate);

  // 학생 정보 (맵 생성용)
  const studentMap = new Map([[studentId, studentName ?? "이름 없음"]]);

  return (
    <div className="space-y-6">
      {/* 출석 통계 */}
      <Card>
        <CardHeader title="이번 달 출석 통계" />
        <CardContent>
          <AttendanceStatistics statistics={stats} />
        </CardContent>
      </Card>

      {/* 출석 기록 입력 폼 */}
      <Card>
        <CardHeader title="출석 기록 입력" />
        <CardContent>
          <AttendanceRecordForm
            studentId={studentId}
            studentName={studentName ?? ""}
          />
        </CardContent>
      </Card>

      {/* 출석 기록 목록 */}
      <Card>
        <CardHeader title="출석 기록" />
        <CardContent>
          {records.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm font-medium text-gray-700">
                출석 기록이 없습니다.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                위 폼에서 출석 기록을 입력하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <AttendanceList records={records} studentMap={studentMap} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

