"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button";
import { CreateStudentModal } from "./CreateStudentModal";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateStudentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = (studentId: string, connectionCode: string) => {
    // 학생 상세 페이지로 이동하거나 목록 새로고침
    router.refresh();
    // 연결 코드를 클립보드에 복사할 수도 있음
    if (navigator.clipboard) {
      navigator.clipboard.writeText(connectionCode).catch(() => {
        // 복사 실패 시 무시
      });
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus size={16} />
        신규 등록
      </Button>
      <CreateStudentModal
        open={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}

