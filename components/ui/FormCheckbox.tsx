import { memo } from "react";
import { cn } from "@/lib/cn";
import Checkbox from "@/components/atoms/Checkbox";

export interface FormCheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string | React.ReactNode;
  error?: string;
  description?: string;
}

const FormCheckbox = memo(function FormCheckbox({
  label,
  error,
  description,
  className,
  id,
  ...props
}: FormCheckboxProps) {
  const inputId = id || props.name;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className={cn(
          "flex items-start gap-2 cursor-pointer",
          props.disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <Checkbox
          id={inputId}
          hasError={!!error}
          className={className}
          aria-describedby={describedBy}
          {...props}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-body-2 text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{label}</span>
          {description && (
            <span className="text-body-2 text-[var(--text-tertiary)] dark:text-[var(--text-tertiary)]">{description}</span>
          )}
        </div>
      </label>
      {error && (
        <span id={errorId} className="text-body-2 text-error-600 dark:text-error-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

export default FormCheckbox;

