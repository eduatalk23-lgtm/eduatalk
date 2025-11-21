import { StudentActions } from "../../_components/StudentActions";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

type Student = {
  id: string;
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  is_active?: boolean | null;
};

export async function BasicInfoSection({ student }: { student: Student }) {
  const { role } = await getCurrentUserRole();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">기본 정보</h2>
        <StudentActions
          studentId={student.id}
          studentName={student.name ?? "이름 없음"}
          isActive={student.is_active !== false}
          isAdmin={role === "admin"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm text-gray-500">이름</div>
          <div className="mt-1 text-lg font-medium text-gray-900">
            {student.name ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">학년</div>
          <div className="mt-1 text-lg font-medium text-gray-900">
            {student.grade ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">반</div>
          <div className="mt-1 text-lg font-medium text-gray-900">
            {student.class ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">생년월일</div>
          <div className="mt-1 text-lg font-medium text-gray-900">
            {student.birth_date
              ? new Date(student.birth_date).toLocaleDateString("ko-KR")
              : "-"}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500">계정 상태</div>
          <div className="mt-1">
            {student.is_active === false ? (
              <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                비활성화
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                활성
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

