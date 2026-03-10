import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./_components/LoginForm";
import { AnimatedBackground } from "./_components/AnimatedBackground";
import { GlassCard } from "./_components/GlassCard";
import { SITE_URL } from "@/lib/constants/routes";

const TITLE = "로그인 - TimeLevelUp";
const DESCRIPTION =
  "TimeLevelUp에 로그인하여 AI 맞춤형 학습 관리 시스템을 이용하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/login`,
    siteName: "TimeLevelUp",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: { canonical: `${SITE_URL}/login` },
};

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen w-full items-center justify-center p-4">
      <AnimatedBackground />
      <GlassCard className="w-full max-w-[420px]">
        <Suspense>
          <LoginForm />
        </Suspense>
      </GlassCard>
    </section>
  );
}
