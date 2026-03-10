import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/routes";

const TITLE = "회원가입 - TimeLevelUp";
const DESCRIPTION =
  "TimeLevelUp에 가입하고 AI 맞춤형 학습 관리 시스템을 무료로 시작하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/signup`,
    siteName: "TimeLevelUp",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: { canonical: `${SITE_URL}/signup` },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
