import { memo } from "react";
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
  const inputId = id || props.name;

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
      {label}
      <input
        id={inputId}
        className={cn(
          "rounded border px-3 py-2",
          "text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]",
          error && "border-red-500",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
});

export default FormInput;

