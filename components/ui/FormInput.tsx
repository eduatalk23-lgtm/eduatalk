import { memo, useId, forwardRef } from "react";
import { cn } from "@/lib/cn";
import {
  bgSurfaceVar,
  textPrimaryVar,
  textPlaceholderVar,
  borderInputVar,
} from "@/lib/utils/darkMode";

export interface FormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const FormInput = memo(
  forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
    { label, error, className, id, disabled, ...props },
    ref
  ) {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = errorId || undefined;

    return (
      <label htmlFor={inputId} className="flex flex-col gap-1.5">
        <span className="text-body-2 text-text-primary">{label}</span>
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border transition-base",
            bgSurfaceVar,
            textPrimaryVar,
            `placeholder:${textPlaceholderVar}`,
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:bg-[rgb(var(--color-secondary-50))] dark:disabled:bg-[rgb(var(--color-secondary-900))] disabled:text-[var(--text-disabled)]",
            error
              ? "border-error-500 dark:border-error-600 focus:border-error-500 dark:focus:border-error-600 focus:ring-error-500/20 dark:focus:ring-error-600/20"
              : cn(
                  borderInputVar,
                  "focus:border-[var(--text-primary)] dark:focus:border-[var(--text-primary)] focus:ring-[var(--text-primary)]/20 dark:focus:ring-[var(--text-primary)]/20"
                ),
            "px-3 py-2 text-body-2",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {error && (
          <span
            id={errorId}
            className="text-body-2 text-error-600 dark:text-error-400"
            role="alert"
          >
            {error}
          </span>
        )}
      </label>
    );
  })
);

FormInput.displayName = "FormInput";

export default FormInput;

