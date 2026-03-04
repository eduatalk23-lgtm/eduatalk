"use client";

import { useFormStatus } from "react-dom";
import Button, { ButtonProps } from "@/components/atoms/Button";
import { useDelayedLoading } from "@/lib/hooks/useDelayedLoading";

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
  const showSpinner = useDelayedLoading(pending);

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      isLoading={showSpinner}
      {...props}
    >
      {pending ? pendingText || "처리 중..." : defaultText}
    </Button>
  );
}

