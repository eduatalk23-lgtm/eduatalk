"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { changeUserRole } from "@/lib/domains/auth/actions";
import { useServerAction } from "@/lib/hooks/useServerAction";

export function RoleChangeSection() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const { execute: executeChangeRole, isPending: saving } = useServerAction(changeUserRole, {
    onSuccess: () => {
      showSuccess("학생 계정으로 전환되었습니다.");
      router.push("/settings");
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleChangeToStudent = () => {
    if (
      !confirm(
        "학생 계정으로 전환하시겠습니까? 현재 학부모 정보가 삭제되고, 학생 정보를 다시 입력해야 합니다."
      )
    ) {
      return;
    }

    executeChangeRole("student");
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        회원 유형 변경
      </h2>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>주의:</strong> 학생 계정으로 전환하면 현재 학부모 정보가 삭제되고, 학생 기능만 사용할 수 있습니다. 학생 정보를 다시 입력해야 합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleChangeToStudent}
          disabled={saving}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "전환 중..." : "학생 계정으로 전환"}
        </button>
      </div>
    </div>
  );
}

