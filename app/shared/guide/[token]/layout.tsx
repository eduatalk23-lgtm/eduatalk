import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "탐구 가이드 - TimeLevelUp",
};

export default function SharedGuideLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white text-[#111]">
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-100">
        Powered by TimeLevelUp
      </footer>
    </div>
  );
}
