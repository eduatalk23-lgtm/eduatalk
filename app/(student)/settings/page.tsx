
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/domains/student";
import { getSchoolById } from "@/lib/domains/school";
import SettingsPageClient from "./_components/SettingsPageClient";
import type { StudentData } from "./types";

/**
 * 학생 설정 페이지 (서버 컴포넌트)
 * 데이터 페칭을 서버에서 수행하고 클라이언트 컴포넌트로 전달합니다.
 */
export default async function SettingsPage() {
  // 서버에서 학생 데이터 페칭
  const studentData = await getCurrentStudent();

  // 학교 타입 조회 (school_id가 있는 경우)
  let schoolType: "중학교" | "고등학교" | undefined = undefined;
  if (studentData?.school_id) {
    try {
      const school = await getSchoolById(studentData.school_id);
      if (school && (school.type === "중학교" || school.type === "고등학교")) {
        schoolType = school.type;
      }
    } catch (error) {
      console.error("학교 타입 조회 실패:", error);
    }
  }

  return (
    <SettingsPageClient
      initialData={studentData as StudentData | null}
      initialSchoolType={schoolType}
    />
  );
}
