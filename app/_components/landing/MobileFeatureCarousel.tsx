"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PILLARS } from "./constants";

export function MobileFeatureCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / PILLARS.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(idx);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4"
      >
        {PILLARS.map((pillar) => (
          <div
            key={pillar.id}
            className={`flex-shrink-0 w-[75vw] max-w-[280px] snap-center rounded-2xl ${pillar.color} p-6`}
          >
            <h3 className={`text-lg font-bold ${pillar.textColor} mb-2`}>
              {pillar.name}
            </h3>
            <p className={`text-sm ${pillar.textColor} opacity-80`}>
              {pillar.tagline}
            </p>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-3">
        {PILLARS.map((pillar, i) => (
          <span
            key={pillar.id}
            className={`h-2 rounded-full transition-all ${
              i === activeIndex
                ? "w-5 bg-primary-600"
                : "w-2 bg-gray-300 dark:bg-slate-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
