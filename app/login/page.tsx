import { Suspense } from "react";
import { LoginForm } from "./_components/LoginForm";
import { AnimatedBackground } from "./_components/AnimatedBackground";
import { GlassCard } from "./_components/GlassCard";

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
