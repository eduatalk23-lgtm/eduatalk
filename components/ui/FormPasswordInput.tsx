"use client";

import { memo, useId, forwardRef, useState, useCallback } from "react";
import PasswordInput from "@/components/atoms/PasswordInput";
import PasswordStrengthIndicator from "@/components/atoms/PasswordStrengthIndicator";

export interface FormPasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  showStrengthIndicator?: boolean;
  showChecklist?: boolean;
}

const FormPasswordInput = memo(
  forwardRef<HTMLInputElement, FormPasswordInputProps>(function FormPasswordInput(
    {
      label,
      error,
      showStrengthIndicator = false,
      showChecklist = false,
      className,
      id,
      disabled,
      onChange,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = errorId || undefined;

    const [passwordValue, setPasswordValue] = useState("");

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordValue(e.target.value);
        onChange?.(e);
      },
      [onChange]
    );

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-body-2 text-text-primary">
          {label}
        </label>
        <PasswordInput
          ref={ref}
          id={inputId}
          disabled={disabled}
          hasError={!!error}
          className={className}
          aria-describedby={describedBy}
          onChange={handleChange}
          {...props}
        />
        {showStrengthIndicator && (
          <PasswordStrengthIndicator
            password={passwordValue}
            showChecklist={showChecklist}
            className="mt-1"
          />
        )}
        {error && (
          <span
            id={errorId}
            className="text-body-2 text-error-600 dark:text-error-400"
            role="alert"
          >
            {error}
          </span>
        )}
      </div>
    );
  })
);

FormPasswordInput.displayName = "FormPasswordInput";

export default FormPasswordInput;
