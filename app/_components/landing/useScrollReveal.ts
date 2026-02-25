"use client";

import { useRef, useState, useEffect, useSyncExternalStore } from "react";

/** Check prefers-reduced-motion via useSyncExternalStore (SSR-safe) */
function getReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/**
 * IntersectionObserver-based scroll reveal hook.
 * Returns a ref and isVisible flag. Once the element enters the viewport,
 * isVisible becomes true and stays true (one-shot).
 * Respects `prefers-reduced-motion: reduce` — immediately visible.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.15,
) {
  const ref = useRef<T>(null);
  const prefersReducedMotion = useSyncExternalStore(
    subscribe,
    getReducedMotion,
    () => false,
  );
  const [isVisible, setIsVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion || isVisible) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, prefersReducedMotion, isVisible]);

  return { ref, isVisible };
}
