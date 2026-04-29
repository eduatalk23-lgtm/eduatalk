interface TocPart {
  label: string;
  /** true이면 hasDesignGrades prop이 true일 때만 표시 */
  designOnly?: boolean;
  items: Array<{ title: string; desc: string }>;
}

const TOC_PARTS: TocPart[] = [
  {
    label: "분석 현황",
    items: [
      { title: "AI 종합 분석", desc: "종합 점수(S~D) · 강점/약점 · 대학 적합도" },
      { title: "종합 역량 추이", desc: "시점별 변화 · 목표갭 · 다음 액션" },
      { title: "생기부 진행 상태", desc: "4-layer 진척 매트릭스 · 컨설턴트 액션 리스트" },
      { title: "포트폴리오 개요", desc: "핵심 지표 대시보드 + 한줄 소견" },
      { title: "활동 요약서", desc: "7개 영역 AI 서술 요약" },
      { title: "교과 성적 분석", desc: "GPA 추이, 교과군별 분석" },
      { title: "역량 분석", desc: "10항목 레이더 + 성장 추이 + 루브릭" },
      { title: "종합 진단", desc: "강점/약점, 추천전공, 교과이수적합도" },
      { title: "스토리라인", desc: "3년 성장 서사 + 활동 분포 + 로드맵" },
      { title: "활동 연결 분석", desc: "7종 엣지 크로스레퍼런스" },
    ],
  },
  {
    label: "설계 방향",
    designOnly: true,
    items: [
      { title: "학년별 설계 가이드", desc: "수강 계획 · 세특/창체/행특 방향" },
      { title: "설계 방향 분석", desc: "갭 분석 · 예상 역량 · 가안 품질" },
    ],
  },
  {
    label: "종합",
    items: [
      { title: "보완 전략", desc: "우선순위 매트릭스 + 실행 계획" },
      { title: "이번 달 액션", desc: "당월 실행 항목" },
      { title: "대학별 지원 전략", desc: "평가 기준 매칭 + 역량 대응" },
      { title: "면접 예상 질문", desc: "5유형 분류 + 제안 답변" },
      { title: "우회학과 분석", desc: "교차지원 후보 상위 5개" },
      { title: "종합 결론", desc: "최종 평가 + 핵심 권고" },
    ],
  },
];

interface TableOfContentsProps {
  hasDesignGrades?: boolean;
}

export function TableOfContents({ hasDesignGrades = false }: TableOfContentsProps) {
  const visibleParts = TOC_PARTS.filter(
    (part) => !part.designOnly || hasDesignGrades,
  );

  let globalIdx = 0;

  return (
    <section className="print-break-before print-avoid-break py-12">
      <p className="mb-1 text-center text-xs font-medium uppercase tracking-widest text-indigo-500">
        Contents
      </p>
      <h2 className="mb-8 text-center text-2xl font-bold text-text-primary">섹션 목록</h2>

      <div className="mx-auto max-w-xl space-y-6">
        {visibleParts.map((part, partIdx) => (
          <div key={partIdx}>
            <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Part {partIdx + 1}: {part.label}
            </p>
            <div className="space-y-1">
              {part.items.map((item) => {
                globalIdx++;
                return (
                  <div
                    key={globalIdx}
                    className="flex gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-secondary"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                      {globalIdx}
                    </span>
                    <div className="flex-1 border-b border-dotted border-border pb-2">
                      <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                      <p className="text-xs text-text-tertiary">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
