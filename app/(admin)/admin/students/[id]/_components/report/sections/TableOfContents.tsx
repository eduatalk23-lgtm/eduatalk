const TOC_ITEMS = [
  { title: "엑서큐티브 요약", desc: "핵심 지표 대시보드 + 한줄 소견" },
  { title: "활동 요약서", desc: "7개 영역 AI 서술 요약" },
  { title: "교과 성적 분석", desc: "GPA 추이, 교과군별 분석" },
  { title: "역량 분석", desc: "10항목 레이더 + 성장 추이 + 루브릭" },
  { title: "종합 진단", desc: "강점/약점, 추천전공, 교과이수적합도" },
  { title: "스토리라인", desc: "3년 성장 서사 + 활동 분포 + 로드맵" },
  { title: "활동 연결 분석", desc: "7종 엣지 크로스레퍼런스" },
  { title: "모평 분석", desc: "백분위, 표준점수, 상위3등급합" },
  { title: "지원 현황", desc: "수시/정시 지원 목록 + 면접 충돌" },
  { title: "진단→설계→전략 연결", desc: "인과 흐름도" },
  { title: "보완 전략", desc: "우선순위 매트릭스 + 실행 계획" },
  { title: "세특 방향 가이드", desc: "과목별 방향 + 교사 포인트" },
  { title: "면접 예상 질문", desc: "5유형 분류 + 제안 답변" },
  { title: "우회학과 분석", desc: "교차지원 후보 상위 5개" },
  { title: "점검 사항", desc: "경고 + 알림" },
];

export function TableOfContents() {
  return (
    <section className="print-break-before print-avoid-break py-12">
      <p className="mb-1 text-center text-xs font-medium uppercase tracking-widest text-indigo-500">
        Contents
      </p>
      <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">섹션 목록</h2>

      <div className="mx-auto max-w-xl space-y-1">
        {TOC_ITEMS.map((item, idx) => (
          <div
            key={idx}
            className="flex gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
              {idx + 1}
            </span>
            <div className="flex-1 border-b border-dotted border-gray-200 pb-2">
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
