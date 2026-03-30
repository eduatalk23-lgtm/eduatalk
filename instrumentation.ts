export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  // @ts-expect-error — Sentry SDK 타입이 Next.js onRequestError와 완전히 일치하지 않음
  return captureRequestError(...args);
};
