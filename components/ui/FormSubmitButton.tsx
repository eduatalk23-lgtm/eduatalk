"use client";

import { useFormStatus } from "react-dom";
import Button, { ButtonProps } from "@/components/atoms/Button";

export interface FormSubmitButtonProps extends Omit<ButtonProps, "isLoading"> {
  pendingText?: string;
  defaultText: string;
}

export default function FormSubmitButton({
  pendingText,
  defaultText,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      isLoading={pending}
      {...props}
    >
      {pending ? pendingText || "처리 중..." : defaultText}
    </Button>
  );
}

