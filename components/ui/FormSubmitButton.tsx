"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export interface FormSubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
  defaultText: string;
}

export default function FormSubmitButton({
  pendingText,
  defaultText,
  className,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "rounded bg-black px-4 py-2 text-white disabled:opacity-50",
        className
      )}
      {...props}
    >
      {pending ? pendingText || "처리 중..." : defaultText}
    </button>
  );
}

