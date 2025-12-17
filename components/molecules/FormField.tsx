"use client";

import { memo, forwardRef, useId } from "react";
import { cn } from "@/lib/cn";
import Label from "@/components/atoms/Label";
import Input, { InputSize } from "@/components/atoms/Input";
import Select, { SelectSize } from "@/components/atoms/Select";

// ============================================
// FormField (Input 기반)
// ============================================

export type FormFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  inputSize?: InputSize;
};

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      error,
      hint,
      required = false,
      inputSize = "md",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
        <Input
          ref={ref}
          id={inputId}
          inputSize={inputSize}
          hasError={!!error}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-error-600 dark:text-error-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-[var(--text-secondary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = "FormField";

// ============================================
// FormSelect (Select 기반)
// ============================================

export type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  selectSize?: SelectSize;
  options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  placeholder?: string;
};

const FormSelectComponent = forwardRef<HTMLSelectElement, FormSelectProps>(
  (
    {
      label,
      error,
      hint,
      required = false,
      selectSize = "md",
      options,
      placeholder,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || props.name || generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const hintId = hint && !error ? `${selectId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={selectId} required={required}>
          {label}
        </Label>
        <Select
          ref={ref}
          id={selectId}
          selectSize={selectSize}
          hasError={!!error}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </Select>
        {error && (
          <p id={errorId} className="text-xs text-error-600 dark:text-error-400" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-[var(--text-secondary)]">{hint}</p>
        )}
      </div>
    );
  }
);

FormSelectComponent.displayName = "FormSelect";

export const FormSelect = memo(FormSelectComponent);
export default memo(FormField);

