"use client";

import ErrorPage from "@/components/errors/ErrorPage";
import { getContainerClass } from "@/lib/constants/layout";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className={getContainerClass("DASHBOARD", "lg")}>
      <ErrorPage error={error} reset={reset} role="student" />
    </div>
  );
}