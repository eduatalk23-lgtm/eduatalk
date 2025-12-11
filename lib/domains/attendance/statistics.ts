/**
 * 출석 통계 데이터 조회 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export type AttendanceChartData = {
  date: string;
  present: number;
  absent: number;
  late: number;
  early_leave: number;
  excused: number;
};

export type MethodStatistics = {
  method: "manual" | "qr" | "location" | "auto";
  count: number;
  percentage: number;
};

export type TimeDistribution = {
  hour: number;
  count: number;
};

/**
 * 일별 출석 통계 조회
 */
export async function getDailyAttendanceStats(
  startDate: string,
  endDate: string,
  studentId?: string
): Promise<AttendanceChartData[]> {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    return [];
  }
  
  let query = supabase
    .from("attendance_records")
    .select("attendance_date, status")
    .eq("tenant_id", tenantContext.tenantId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .order("attendance_date", { ascending: true });
  
  if (studentId) {
    query = query.eq("student_id", studentId);
  }
  
  const { data } = await query;
  
  // 날짜별로 그룹화
  const grouped = new Map<string, AttendanceChartData>();
  
  (data || []).forEach((record) => {
    const date = record.attendance_date;
    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        present: 0,
        absent: 0,
        late: 0,
        early_leave: 0,
        excused: 0,
      });
    }
    
    const stats = grouped.get(date)!;
    switch (record.status) {
      case "present":
        stats.present++;
        break;
      case "absent":
        stats.absent++;
        break;
      case "late":
        stats.late++;
        break;
      case "early_leave":
        stats.early_leave++;
        break;
      case "excused":
        stats.excused++;
        break;
    }
  });
  
  return Array.from(grouped.values());
}

/**
 * 입실 방법별 통계 조회
 */
export async function getCheckInMethodStats(
  startDate: string,
  endDate: string,
  studentId?: string
): Promise<MethodStatistics[]> {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    return [];
  }
  
  let query = supabase
    .from("attendance_records")
    .select("check_in_method")
    .eq("tenant_id", tenantContext.tenantId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .not("check_in_method", "is", null);
  
  if (studentId) {
    query = query.eq("student_id", studentId);
  }
  
  const { data } = await query;
  
  const methodCounts = new Map<string, number>();
  let total = 0;
  
  (data || []).forEach((record) => {
    const method = record.check_in_method;
    if (method) {
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
      total++;
    }
  });
  
  return Array.from(methodCounts.entries()).map(([method, count]) => ({
    method: method as "manual" | "qr" | "location" | "auto",
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));
}

/**
 * 시간대별 입실 분포 조회
 */
export async function getCheckInTimeDistribution(
  startDate: string,
  endDate: string,
  studentId?: string
): Promise<TimeDistribution[]> {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    return [];
  }
  
  let query = supabase
    .from("attendance_records")
    .select("check_in_time")
    .eq("tenant_id", tenantContext.tenantId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .not("check_in_time", "is", null);
  
  if (studentId) {
    query = query.eq("student_id", studentId);
  }
  
  const { data } = await query;
  
  const hourCounts = new Map<number, number>();
  
  (data || []).forEach((record) => {
    if (record.check_in_time) {
      const hour = new Date(record.check_in_time).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
  });
  
  // 0-23시까지 모든 시간대 포함
  const distribution: TimeDistribution[] = [];
  for (let hour = 0; hour < 24; hour++) {
    distribution.push({
      hour,
      count: hourCounts.get(hour) || 0,
    });
  }
  
  return distribution;
}

/**
 * 학생별 출석률 랭킹 조회
 */
export async function getStudentAttendanceRanking(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<Array<{ student_id: string; student_name: string; attendance_rate: number }>> {
  const supabase = await createSupabaseServerClient();
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    return [];
  }
  
  // 출석 기록 조회
  const { data: records } = await supabase
    .from("attendance_records")
    .select("student_id, status")
    .eq("tenant_id", tenantContext.tenantId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate);
  
  if (!records || records.length === 0) {
    return [];
  }
  
  // 학생별 통계 계산
  const studentStats = new Map<string, { total: number; present: number }>();
  
  records.forEach((record) => {
    const stats = studentStats.get(record.student_id) || { total: 0, present: 0 };
    stats.total++;
    if (record.status === "present") {
      stats.present++;
    }
    studentStats.set(record.student_id, stats);
  });
  
  // 학생 정보 조회
  const studentIds = Array.from(studentStats.keys());
  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .in("id", studentIds);
  
  const studentMap = new Map(
    (students || []).map((s) => [s.id, s.name || "이름 없음"])
  );
  
  // 출석률 계산 및 정렬
  const ranking = Array.from(studentStats.entries())
    .map(([studentId, stats]) => ({
      student_id: studentId,
      student_name: studentMap.get(studentId) || "이름 없음",
      attendance_rate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.attendance_rate - a.attendance_rate)
    .slice(0, limit);
  
  return ranking;
}

