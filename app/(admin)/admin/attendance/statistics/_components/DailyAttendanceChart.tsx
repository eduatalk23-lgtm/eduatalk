"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { AttendanceChartData } from "@/lib/domains/attendance/statistics";
import { getChartColor } from "@/lib/constants/colors";

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
        <Line type="monotone" dataKey="present" stroke={getChartColor(4)} name="출석" strokeWidth={2} />
        <Line type="monotone" dataKey="absent" stroke={getChartColor(6)} name="결석" strokeWidth={2} />
        <Line type="monotone" dataKey="late" stroke={getChartColor(3)} name="지각" strokeWidth={2} />
        <Line type="monotone" dataKey="early_leave" stroke={getChartColor(3)} name="조퇴" strokeWidth={2} />
        <Line type="monotone" dataKey="excused" stroke={getChartColor(5)} name="공결" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

