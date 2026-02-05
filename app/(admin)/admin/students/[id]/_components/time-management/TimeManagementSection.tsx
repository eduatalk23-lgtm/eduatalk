import {
  getStudentExclusionsForAdmin,
  getStudentAcademiesWithSchedulesForAdmin,
} from "@/lib/domains/admin-plan/actions/timeManagement";
import { TimeManagementSectionClient } from "./TimeManagementSectionClient";

interface TimeManagementSectionProps {
  studentId: string;
}

export async function TimeManagementSection({
  studentId,
}: TimeManagementSectionProps) {
  // 데이터 프리페치
  const [exclusionsResult, academiesResult] = await Promise.all([
    getStudentExclusionsForAdmin(studentId),
    getStudentAcademiesWithSchedulesForAdmin(studentId),
  ]);

  return (
    <TimeManagementSectionClient
      studentId={studentId}
      initialExclusions={exclusionsResult.data ?? []}
      initialAcademies={academiesResult.data ?? []}
    />
  );
}
