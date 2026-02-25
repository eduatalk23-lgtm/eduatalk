"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURES } from "./constants";
import type { FeatureCard } from "./types";
import { useScrollReveal } from "./useScrollReveal";

export function FeaturesSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="features" className="px-4 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full bg-primary-50 px-4 py-1.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 mb-4">
            주요 기능
          </span>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            학습의 모든 것을 하나로
          </h2>
          <p className="mt-3 text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
            AI 기반 학습 플래너, 성적 분석, 출결 관리까지. 학습에 필요한
            모든 기능을 통합했습니다.
          </p>
        </div>

        {/* Bento grid */}
        <div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 auto-rows-[minmax(180px,auto)]"
        >
          {FEATURES.map((feature, i) => (
            <FeatureCardItem
              key={feature.id}
              feature={feature}
              isVisible={isVisible}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCardItem({
  feature,
  isVisible,
  index,
}: {
  feature: FeatureCard;
  isVisible: boolean;
  index: number;
}) {
  const isLarge = feature.rowSpan?.includes("row-span-2");
  const Icon = feature.icon;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:shadow-lg hover:border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 ${feature.colSpan} ${feature.rowSpan ?? ""} ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
      style={isVisible ? { animationDelay: `${index * 100}ms` } : undefined}
    >
      {/* Gradient accent */}
      <div
        className={`absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl ${feature.color} rounded-bl-full opacity-5 transition-opacity group-hover:opacity-10`}
      />

      <div className={`relative flex flex-col ${isLarge ? "h-full justify-between" : "gap-3"}`}>
        <div>
          <div
            className={`inline-flex items-center justify-center rounded-xl p-2.5 mb-3 ${feature.iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
            {feature.title}
          </h3>

          <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">
            {feature.description}
          </p>
        </div>

        {/* Large card: stats badges + CTA */}
        {isLarge && (
          <div className="mt-4 space-y-4">
            {feature.stats && feature.stats.length > 0 && (
              <div className="flex items-center gap-4">
                {feature.stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-700/50">
                    <span className={`text-xl font-bold ${stat.color} dark:brightness-125`}>
                      {stat.value}
                    </span>
                    <span className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {feature.ctaLabel && (
              <Link
                href={feature.ctaHref ?? "/signup"}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 transition-colors group-hover:text-gray-900 dark:text-slate-400 dark:group-hover:text-white"
              >
                {feature.ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        )}

        {/* Normal card: CTA link */}
        {!isLarge && feature.ctaLabel && (
          <Link
            href={feature.ctaHref ?? "/signup"}
            className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors group-hover:text-gray-900 group-hover:underline dark:text-slate-400 dark:group-hover:text-white"
          >
            {feature.ctaLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
