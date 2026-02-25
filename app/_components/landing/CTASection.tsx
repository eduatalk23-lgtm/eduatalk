"use client";

import { Rocket, ArrowRight } from "lucide-react";
import { useScrollReveal } from "./useScrollReveal";

interface CTASectionProps {
  onCtaClick: () => void;
}

export function CTASection({ onCtaClick }: CTASectionProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-7xl">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-blue-600 to-indigo-800 px-8 py-16 text-center sm:px-16 lg:py-24"
        >
          {/* Decorative blobs */}
          <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-blob-1" />
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl animate-blob-2" />

          <div className="relative">
            <div
              className={`mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
            >
              <Rocket className="h-4 w-4" />
              지금 바로 시작하세요
            </div>

            <h2
              className={`text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
              style={isVisible ? { animationDelay: "100ms" } : undefined}
            >
              학습의 차이를 경험하세요
            </h2>

            <p
              className={`mx-auto mt-4 max-w-2xl text-lg text-blue-100 ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
              style={isVisible ? { animationDelay: "200ms" } : undefined}
            >
              AI가 설계하는 맞춤형 학습 플랜으로 효율적인 공부를 시작하세요.
              무료 체험으로 직접 확인해보세요.
            </p>

            <div
              className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${isVisible ? "animate-reveal-up" : "opacity-0"}`}
              style={isVisible ? { animationDelay: "300ms" } : undefined}
            >
              <button
                type="button"
                onClick={onCtaClick}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-primary-700 shadow-xl transition-all hover:bg-gray-50 hover:shadow-2xl active:scale-[0.98]"
              >
                3분만에 시작하기
                <ArrowRight className="h-5 w-5" />
              </button>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/50"
              >
                요금제 보기
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
