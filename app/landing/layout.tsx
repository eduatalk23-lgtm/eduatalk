import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "에듀엣톡 생기부 레벨업 - 수시합격 매뉴얼",
  description: "에듀엣톡 생기부 컨설팅 - 수시합격 매뉴얼",
  keywords:
    "생기부 컨설팅, 학생부 종합전형, 고교학점제, 세특 관리, 활동 기록, 입시 전략, 비교과 관리, 진로 상담, 학부모 상담",
  openGraph: {
    title: "에듀엣톡 생기부 레벨업",
    description: "에듀엣톡 생기부 컨설팅 - 수시합격 매뉴얼",
    images: ["/landing/img1.jpg"],
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
