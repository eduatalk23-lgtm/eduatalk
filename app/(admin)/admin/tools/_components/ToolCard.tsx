"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

export type ToolCardProps = {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  buttonDisabled?: boolean;
  onButtonClick?: () => void;
};

function ToolCardComponent({
  icon,
  title,
  description,
  buttonText,
  buttonDisabled = false,
  onButtonClick,
}: ToolCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="text-2xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <button
          onClick={onButtonClick}
          disabled={buttonDisabled}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            buttonDisabled
              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

export const ToolCard = memo(ToolCardComponent);
export default ToolCard;





