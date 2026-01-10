"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StyledInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const StyledInput = React.forwardRef<HTMLInputElement, StyledInputProps>(
  ({ className, type, label, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);

    return (
      <div className="relative mb-2">
        <input
          type={type}
          className={cn(
            "peer w-full rounded-xl border border-neutral-200 bg-white/50 px-4 pb-2 pt-6 text-base outline-none transition-all duration-200",
            "focus:border-black/20 focus:bg-white/80 focus:ring-4 focus:ring-black/5",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "placeholder:text-transparent focus:placeholder:text-neutral-400",
            className
          )
}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            setIsFocused(false);
            setHasValue(e.target.value.length > 0);
          }}
          onChange={(e) => {
             setHasValue(e.target.value.length > 0);
             props.onChange?.(e);
          }}
          {...props}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-4 transition-all duration-200 text-neutral-500",
            (isFocused || hasValue || props.value) 
              ? "top-2 text-xs font-medium text-neutral-700"
              : "top-4 text-base"
          )}
        >
          {label}
        </label>
      </div>
    );
  }
);
StyledInput.displayName = "StyledInput";
