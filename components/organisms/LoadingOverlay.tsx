"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/atoms/Spinner";

export type LoadingOverlayProps = {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  className?: string;
};

function LoadingOverlayComponent({
  isLoading,
  message,
  fullScreen = false,
  className,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm",
        fullScreen ? "fixed inset-0 z-50" : "absolute inset-0 z-10",
        className
      )}
    >
      <Spinner size="lg" />
      {message && (
        <p className="text-sm font-medium text-gray-600">{message}</p>
      )}
    </div>
  );
}

export const LoadingOverlay = memo(LoadingOverlayComponent);
export default LoadingOverlay;

