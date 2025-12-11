"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { AttendanceChartData } from "@/lib/domains/attendance/statistics";

type DailyAttendanceChartProps = {
  data: AttendanceChartData[];
};

export function DailyAttendanceChart({ data }: DailyAttendanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        데이터가 없습니다.
      </div>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="present" stroke="#10b981" name="출석" strokeWidth={2} />
        <Line type="monotone" dataKey="absent" stroke="#ef4444" name="결석" strokeWidth={2} />
        <Line type="monotone" dataKey="late" stroke="#f59e0b" name="지각" strokeWidth={2} />
        <Line type="monotone" dataKey="early_leave" stroke="#f97316" name="조퇴" strokeWidth={2} />
        <Line type="monotone" dataKey="excused" stroke="#3b82f6" name="공결" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

