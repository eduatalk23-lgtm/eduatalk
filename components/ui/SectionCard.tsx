"use client";

import { ReactNode } from "react";
import { Card, CardHeader, CardContent } from "@/components/molecules/Card";
import { cn } from "@/lib/cn";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
};

export function SectionCard({
  title,
  description,
  children,
  className,
  headerAction,
}: SectionCardProps) {
  return (
    <Card className={cn("flex flex-col gap-4", className)}>
      <CardHeader
        title={title}
        description={description}
        action={headerAction}
      />
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

