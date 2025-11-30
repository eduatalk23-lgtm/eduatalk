"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ children, required = false, className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="text-red-500">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";

export default memo(Label);

