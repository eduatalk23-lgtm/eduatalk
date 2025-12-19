"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import {
  bgSurfaceVar,
  borderDefaultVar,
  textPrimaryVar,
  textTertiaryVar,
} from "@/lib/utils/darkMode";

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
    <div className={cn("rounded-lg border p-6 shadow-sm", bgSurfaceVar, borderDefaultVar)}>
      <div className="flex flex-col gap-4">
        <div className="text-2xl">{icon}</div>
        <div className="flex flex-col gap-2">
          <h2 className={cn("text-lg font-semibold", textPrimaryVar)}>{title}</h2>
          <p className={cn("text-sm", textTertiaryVar)}>{description}</p>
        </div>
        <Button
          onClick={onButtonClick}
          disabled={buttonDisabled}
          variant="primary"
          size="md"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}

export const ToolCard = memo(ToolCardComponent);
export default ToolCard;






