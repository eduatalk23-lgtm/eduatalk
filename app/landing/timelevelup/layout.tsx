import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "타임레벨업 - 에듀엣톡 One-Pass 학습 솔루션",
  description:
    "대치동 13년 입시컨설팅의 본질을 담은 특허 출원 공부법. 1730플랜으로 단권화 학습하고 한 번에 대학 Pass!",
  keywords:
    "타임레벨업, 에듀엣톡, One-Pass, 1730플랜, 단권화 학습, 자기주도 학습, 학습 캠프, 입시 컨설팅",
  openGraph: {
    title: "타임레벨업 - 에듀엣톡 One-Pass 학습 솔루션",
    description:
      "대치동 13년 입시컨설팅의 본질을 담은 특허 출원 공부법. 1730플랜으로 단권화 학습하고 한 번에 대학 Pass!",
    images: ["/landing-timelevelup/og.png"],
  },
};

export default function TimeLevelUpLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
