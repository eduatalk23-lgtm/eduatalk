export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import {
  getDailyAttendanceStats,
  getCheckInMethodStats,
  getCheckInTimeDistribution,
  getStudentAttendanceRanking,
} from "@/lib/domains/attendance/statistics";
import { DailyAttendanceChart } from "./_components/DailyAttendanceChart";
import { MethodStatisticsChart } from "./_components/MethodStatisticsChart";
import { TimeDistributionChart } from "./_components/TimeDistributionChart";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";

export default async function AttendanceStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();
  
  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }
  
  const params = await searchParams;
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const startDate = params.start_date || thirtyDaysAgo.toISOString().slice(0, 10);
  const endDate = params.end_date || today.toISOString().slice(0, 10);
  const studentId = params.student_id;
  
  const [dailyStats, methodStats, timeDistribution, ranking] = await Promise.all([
    getDailyAttendanceStats(startDate, endDate, studentId),
    getCheckInMethodStats(startDate, endDate, studentId),
    getCheckInTimeDistribution(startDate, endDate, studentId),
    getStudentAttendanceRanking(startDate, endDate, 10),
  ]);
  
  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">출석 통계</h1>
      </div>
      
      {/* 필터 */}
      <div className="mb-6">
        <form method="get" className="flex flex-col gap-4 md:flex-row">
          <Input
            type="date"
            name="start_date"
            defaultValue={startDate}
            className="w-full md:w-auto"
          />
          <Input
            type="date"
            name="end_date"
            defaultValue={endDate}
            className="w-full md:w-auto"
          />
          <Button type="submit" variant="primary">
            조회
          </Button>
          {(params.start_date || params.end_date || params.student_id) && (
            <a
              href="/admin/attendance/statistics"
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center"
            >
              초기화
            </a>
          )}
        </form>
      </div>
      
      {/* 차트 그리드 */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="일별 출석 통계" />
          <CardContent>
            <DailyAttendanceChart data={dailyStats} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader title="입실 방법별 통계" />
          <CardContent>
            <MethodStatisticsChart data={methodStats} />
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader title="시간대별 입실 분포" />
          <CardContent>
            <TimeDistributionChart data={timeDistribution} />
          </CardContent>
        </Card>
      </div>
      
      {/* 학생별 출석률 랭킹 */}
      <Card>
        <CardHeader title="학생별 출석률 랭킹" />
        <CardContent>
          {ranking.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">순위</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">학생명</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">출석률</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((student, index) => (
                    <tr key={student.student_id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{index + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{student.student_name}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {student.attendance_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

