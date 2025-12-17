import { memo, useId } from "react";
import { cn } from "@/lib/cn";

export interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const FormInput = memo(function FormInput({
  label,
  error,
  className,
  id,
  ...props
}: FormInputProps) {
  const generatedId = useId();
  const inputId = id || props.name || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = errorId || undefined;

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
      {label}
      <input
        id={inputId}
        className={cn(
          "rounded border px-3 py-2",
          "text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]",
          error && "border-error-500",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <span id={errorId} className="text-xs text-error-600 dark:text-error-400" role="alert">
          {error}
        </span>
      )}
    </label>
  );
});

export default FormInput;

