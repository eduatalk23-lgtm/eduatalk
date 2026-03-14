"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button";
import { CreateStudentModal } from "./CreateStudentModal";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateStudentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = (studentId: string, joinUrl?: string) => {
    router.refresh();
    if (joinUrl && navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl).catch(() => {
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

