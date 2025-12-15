"use client";

import ErrorPage from "@/components/errors/ErrorPage";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return <ErrorPage error={error} reset={reset} role="admin" />;
}

