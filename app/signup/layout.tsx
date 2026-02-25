import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입 - TimeLevelUp",
  description:
    "TimeLevelUp에 가입하고 AI 맞춤형 학습 관리 시스템을 무료로 시작하세요.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
