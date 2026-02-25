"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, Quote } from "lucide-react";
import { TESTIMONIALS, STATS } from "./constants";
import { useScrollReveal } from "./useScrollReveal";

export function SocialProofSection() {
  const { ref: testimonialRef, isVisible: testimonialVisible } = useScrollReveal();
  const { ref: statsRef, isVisible: statsVisible } = useScrollReveal();

  return (
    <section id="testimonials" className="px-4 py-20 bg-gray-50/50 dark:bg-slate-900/50">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 mb-4">
            수강생 후기
          </span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            실제 합격생들의 이야기
          </h2>
        </div>

        {/* Testimonials */}
        <div
          ref={testimonialRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar md:grid md:grid-cols-3 md:overflow-visible md:snap-none md:pb-0 mb-16"
        >
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.id}
              className={`relative flex-shrink-0 w-[80vw] max-w-[340px] snap-center rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 md:w-auto md:max-w-none ${testimonialVisible ? "animate-reveal-up" : "opacity-0"}`}
              style={
                testimonialVisible
                  ? { animationDelay: `${i * 150}ms` }
                  : undefined
              }
            >
              <Quote className="absolute top-4 right-4 h-8 w-8 text-gray-100 dark:text-slate-700" />

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300 mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Profile */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  {t.avatarFallback}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t.name}
                  </p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t.university}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div
          ref={statsRef}
          className="flex flex-wrap items-center justify-center gap-8 rounded-2xl bg-white p-8 shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700 lg:gap-16"
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-8">
              <div className="text-center">
                <p
                  className={`text-3xl font-extrabold text-gray-900 dark:text-white ${statsVisible ? "animate-count-in" : "opacity-0"}`}
                  style={
                    statsVisible
                      ? { animationDelay: `${i * 100}ms` }
                      : undefined
                  }
                >
                  <CountUpValue value={stat.value} active={statsVisible} />
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  {stat.label}
                </p>
              </div>
              {i < STATS.length - 1 && (
                <div className="hidden sm:block h-12 w-px bg-gray-200 dark:bg-slate-700" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Parse stat value and animate from 0 to target */
function CountUpValue({ value, active }: { value: string; active: boolean }) {
  const { target, prefix, suffix, isFloat } = parseStatValue(value);
  const current = useCountUp(target, active, isFloat);

  if (!active) return <>{value}</>;

  const formatted = isFloat
    ? current.toFixed(1)
    : current >= 1000
      ? current.toLocaleString()
      : String(current);

  return (
    <>
      {prefix}
      {formatted}
      {suffix}
    </>
  );
}

function parseStatValue(value: string) {
  // "4.9/5" → target=4.9, suffix="/5"
  const slashMatch = value.match(/^([\d.]+)(\/\d+)$/);
  if (slashMatch) {
    return {
      target: parseFloat(slashMatch[1]),
      prefix: "",
      suffix: slashMatch[2],
      isFloat: true,
    };
  }

  // "13년+" → target=13, suffix="년+"
  // "2,000+" → target=2000, suffix="+"
  // "97%" → target=97, suffix="%"
  const numMatch = value.match(/^([\d,]+)(.*?)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1].replace(/,/g, ""));
    return {
      target: num,
      prefix: "",
      suffix: numMatch[2],
      isFloat: false,
    };
  }

  return { target: 0, prefix: "", suffix: value, isFloat: false };
}

function useCountUp(target: number, active: boolean, isFloat: boolean) {
  const [current, setCurrent] = useState(0);

  const animate = useCallback(() => {
    if (!active || target === 0) return;

    const duration = 1500;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = eased * target;

      setCurrent(isFloat ? Math.round(val * 10) / 10 : Math.round(val));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [active, target, isFloat]);

  useEffect(() => {
    animate();
  }, [animate]);

  return current;
}
