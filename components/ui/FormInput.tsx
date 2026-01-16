import { memo, useId, forwardRef } from "react";
import Input from "@/components/atoms/Input";

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
        <Input
          ref={ref}
          id={inputId}
          disabled={disabled}
          hasError={!!error}
          className={className}
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

