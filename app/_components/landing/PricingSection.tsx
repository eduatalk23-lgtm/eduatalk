"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { PRICING_PLANS } from "./constants";
import type { PricingPlan } from "./types";
import { useScrollReveal } from "./useScrollReveal";

export function PricingSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="pricing" className="px-4 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            요금제
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            나에게 맞는 플랜을 선택하세요
          </h2>
          <p className="mt-3 text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
            무료로 시작하고, 필요에 따라 업그레이드하세요.
          </p>
        </div>

        {/* Pricing cards */}
        <div
          ref={ref}
          className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start"
        >
          {PRICING_PLANS.map((plan, i) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isVisible={isVisible}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const PLAN_HREF: Record<string, string> = {
  free: "/signup",
  pro: "/signup",
  academy: "mailto:support@eduatalk.kr?subject=학원용 플랜 문의",
};

function PricingCard({
  plan,
  isVisible,
  index,
}: {
  plan: PricingPlan;
  isVisible: boolean;
  index: number;
}) {
  const href = PLAN_HREF[plan.id] ?? "/signup";
  const isExternal = href.startsWith("mailto:");

  const ctaClassName = `mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all active:scale-[0.98] ${
    plan.highlighted
      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:shadow-xl"
      : "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
  }`;

  return (
    <div
      className={`relative rounded-2xl border bg-white p-8 transition-all dark:bg-slate-800 ${
        plan.highlighted
          ? "-order-1 lg:order-none border-blue-200 shadow-xl shadow-blue-600/10 ring-2 ring-blue-600/20 dark:border-blue-700 dark:ring-blue-500/20 lg:scale-105"
          : "border-gray-100 shadow-sm hover:shadow-md dark:border-slate-700"
      } ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
      style={isVisible ? { animationDelay: `${index * 120}ms` } : undefined}
    >
      {/* Badge */}
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1 text-xs font-bold text-white shadow-md">
          {plan.badge}
        </span>
      )}

      {/* Plan name + description */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        {plan.name}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        {plan.description}
      </p>

      {/* Price */}
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
          {plan.price}
        </span>
        {plan.period && (
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {plan.period}
          </span>
        )}
      </div>

      {/* CTA */}
      {isExternal ? (
        <a href={href} className={ctaClassName}>
          {plan.ctaLabel}
        </a>
      ) : (
        <Link href={href} className={ctaClassName}>
          {plan.ctaLabel}
        </Link>
      )}

      {/* Features list */}
      <ul className="mt-8 flex flex-col gap-3">
        {plan.includedPlanLabel && (
          <li className="text-sm font-semibold text-gray-900 dark:text-white">
            {plan.includedPlanLabel}
          </li>
        )}
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-slate-300"
          >
            <CheckCircle className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
