"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchool } from "@/app/(admin)/actions/schoolActions";
import { useToast } from "@/components/ui/ToastProvider";
import { SchoolUpsertForm } from "../_components/SchoolUpsertForm";

type SchoolFormProps = {
  regions: Array<{ id: string; name: string }>;
};

export function SchoolForm({ regions }: SchoolFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await createSchool(formData);
        if (result.success) {
          toast.showSuccess("학교가 등록되었습니다.");
          router.push("/admin/schools");
        } else {
          toast.showError(result.error || "학교 등록에 실패했습니다.");
        }
      } catch (error) {
        console.error("학교 등록 실패:", error);
        toast.showError(
          error instanceof Error ? error.message : "학교 등록에 실패했습니다."
        );
      }
    });
  }

  return (
    <SchoolUpsertForm
      regions={regions}
      onSubmit={handleSubmit}
      submitButtonText="등록하기"
      isPending={isPending}
    />
  );
}

