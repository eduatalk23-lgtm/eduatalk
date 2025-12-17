import { memo, useMemo } from "react";
import { cn } from "@/lib/cn";

export interface FormMessageProps {
  type?: "error" | "success" | "info";
  message: string;
  className?: string;
}

const FormMessage = memo(function FormMessage({
  type = "info",
  message,
  className,
}: FormMessageProps) {
  const styles = useMemo(
    () => ({
      error: "bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-300",
      success: "bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300",
      info: "bg-info-50 dark:bg-info-900/30 text-info-700 dark:text-info-300",
    }),
    []
  );

  return (
    <p className={cn("rounded px-3 py-2 text-sm", styles[type], className)}>
      {message}
    </p>
  );
});

export default FormMessage;

