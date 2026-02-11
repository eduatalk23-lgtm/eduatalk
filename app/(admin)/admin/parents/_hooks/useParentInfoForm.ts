"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { z } from "zod";
import type { ParentDetailData } from "@/lib/domains/parent/actions/detail";
import type { AdminParentFormData } from "../_types/parentFormTypes";

// Form input schema (no transforms - matches raw input strings)
const parentFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이내여야 합니다"),
  phone: z.string(),
  email: z
    .string()
    .refine(
      (val) => !val || val.trim() === "" || z.string().email().safeParse(val).success,
      { message: "올바른 이메일 형식을 입력해주세요" }
    ),
});

export function useParentInfoForm(parentData: ParentDetailData | null) {
  const form = useForm<AdminParentFormData>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  // 학부모 데이터가 변경되면 폼 리셋
  useEffect(() => {
    if (parentData) {
      form.reset({
        name: parentData.name ?? "",
        phone: parentData.phone ?? "",
        email: parentData.email ?? "",
      });
    }
  }, [parentData, form]);

  return form;
}
