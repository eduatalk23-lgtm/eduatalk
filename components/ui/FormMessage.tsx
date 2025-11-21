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
      error: "bg-red-50 text-red-700",
      success: "bg-green-50 text-green-700",
      info: "bg-blue-50 text-blue-700",
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

