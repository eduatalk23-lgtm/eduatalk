import { memo } from "react";
import { cn } from "@/lib/cn";

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
        <input
          id={inputId}
          type="checkbox"
          className={cn(
            "mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700",
            error && "border-red-500",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
          {description && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
          )}
        </div>
      </label>
      {error && (
        <span id={errorId} className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

export default FormCheckbox;

