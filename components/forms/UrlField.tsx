"use client";

import FormField from "@/components/molecules/FormField";

type UrlFieldProps = {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  className?: string;
};

export function UrlField({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  required,
  error,
  className,
}: UrlFieldProps) {
  return (
    <FormField
      label={label}
      name={name}
      type="url"
      defaultValue={defaultValue}
      placeholder={placeholder}
      hint={hint}
      required={required}
      error={error}
      className={className}
    />
  );
}

