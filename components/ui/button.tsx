import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: cn(
        "bg-primary-500 text-white hover:bg-primary-600",
        "dark:bg-primary-600 dark:hover:bg-primary-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      ),
      destructive: cn(
        "bg-error-500 text-white hover:bg-error-600",
        "dark:bg-error-600 dark:hover:bg-error-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2"
      ),
      outline: cn(
        "border border-secondary-300 dark:border-secondary-700",
        "bg-white dark:bg-secondary-900",
        "text-secondary-900 dark:text-secondary-100",
        "hover:bg-secondary-50 dark:hover:bg-secondary-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2"
      ),
      secondary: cn(
        "bg-secondary-200 dark:bg-secondary-700",
        "text-secondary-900 dark:text-secondary-100",
        "hover:bg-secondary-300 dark:hover:bg-secondary-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2"
      ),
      ghost: cn(
        "hover:bg-secondary-100 dark:hover:bg-secondary-800",
        "text-secondary-900 dark:text-secondary-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-500 focus-visible:ring-offset-2"
      ),
      link: cn(
        "text-primary-600 dark:text-primary-400",
        "underline-offset-4 hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      ),
    }
    
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    }

    const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
