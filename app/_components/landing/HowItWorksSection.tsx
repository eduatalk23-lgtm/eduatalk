"use client";

import { HOW_IT_WORKS_STEPS } from "./constants";
import { useScrollReveal } from "./useScrollReveal";

export function HowItWorksSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="how-it-works" className="px-4 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            이용 방법
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            어떻게 작동하나요?
          </h2>
          <p className="mt-3 text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
            3단계로 나만의 AI 학습 플랜을 시작하세요.
          </p>
        </div>

        {/* Steps */}
        <div
          ref={ref}
          className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-0"
        >
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`relative flex flex-col items-center text-center ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
                style={isVisible ? { animationDelay: `${i * 150}ms` } : undefined}
              >
                {/* Connecting line (desktop only, not on last) */}
                {i < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div
                    className="absolute top-10 left-1/2 hidden h-0.5 w-full translate-x-10 lg:block"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, #2574f4 50%, transparent 50%)",
                      backgroundSize: "12px 2px",
                    }}
                    aria-hidden
                  />
                )}

                {/* Step number + icon */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                    <Icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md">
                    {step.step}
                  </span>
                </div>

                {/* Text */}
                <h3 className="mt-6 text-lg font-bold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-slate-400">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
