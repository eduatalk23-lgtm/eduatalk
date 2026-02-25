"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { BrowserMockup } from "./BrowserMockup";
import { LandingLoginCard } from "./LandingLoginCard";
import { MobileProductMockup } from "./MobileProductMockup";
import { TRUST_BADGES } from "./constants";

interface HeroSectionProps {
  onMobileLoginClick: () => void;
}

export function HeroSection({ onMobileLoginClick }: HeroSectionProps) {
  return (
    <section className="relative px-4 pt-28 pb-16 lg:pt-32 lg:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-16">
          {/* Left: Content */}
          <div className="flex-1 lg:max-w-[60%]">
            {/* Pills */}
            <div className="flex flex-wrap gap-2 animate-reveal-up">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                AI 학습 플래너
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                13년 입시 전문
              </span>
            </div>

            {/* Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white animate-reveal-up [animation-delay:100ms]">
              AI가 설계하는
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                나만의 학습 플랜
              </span>
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-gray-600 dark:text-slate-300 max-w-xl animate-reveal-up [animation-delay:200ms]">
              대치동 입시 노하우와 AI 기술의 결합으로 최적화된 공부 습관을
              제안합니다. 학습 플랜 생성부터 성적 분석, 진도 관리까지 한번에.
            </p>

            {/* Dual CTA - Desktop */}
            <div className="mt-8 hidden lg:flex items-center gap-4 animate-reveal-up [animation-delay:300ms]">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("login-card");
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98]"
              >
                무료로 시작하기
                <ArrowRight className="h-5 w-5" />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-7 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronDown className="h-4 w-4" />
                이용 방법 보기
              </a>
            </div>

            {/* Dual CTA - Mobile */}
            <div className="mt-8 flex flex-col gap-3 lg:hidden animate-reveal-up [animation-delay:300ms]">
              <button
                type="button"
                onClick={onMobileLoginClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98]"
              >
                무료로 시작하기
                <ArrowRight className="h-5 w-5" />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300"
              >
                <ChevronDown className="h-4 w-4" />
                이용 방법 보기
              </a>
            </div>

            {/* Product mockup - mobile (phone frame) */}
            <div className="mt-8 p-4 lg:hidden animate-reveal-up [animation-delay:400ms]">
              <MobileProductMockup />
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center gap-6 animate-reveal-up [animation-delay:500ms]">
              {TRUST_BADGES.map((badge) => (
                <div
                  key={badge.text}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400"
                >
                  <badge.icon className="h-4 w-4 text-primary-500" />
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login card - desktop only */}
          <div className="hidden lg:flex lg:flex-shrink-0 lg:items-start lg:justify-end animate-reveal-up [animation-delay:300ms]">
            <LandingLoginCard />
          </div>
        </div>

        {/* Product mockup - desktop (full width below hero row) */}
        <div className="mt-12 p-4 hidden lg:block animate-reveal-up [animation-delay:400ms]">
          <BrowserMockup />
        </div>
      </div>
    </section>
  );
}
