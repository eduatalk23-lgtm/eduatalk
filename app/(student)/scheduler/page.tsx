import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AutoScheduleForm } from "./_components/AutoScheduleForm";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SchedulerPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const success = params.success === "true";
  const created = params.created ? parseInt(params.created) : 0;
  const weakSubjects = params.weakSubjects ? parseInt(params.weakSubjects) : 0;
  const scoreBased = params.scoreBased === "true";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-500">자동 스케줄러</p>
        <h1 className="text-3xl font-semibold text-gray-900">
          자동 학습 플랜 생성
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          학생의 콘텐츠와 시간 블록을 기반으로 학습 플랜을 자동으로 생성합니다.
        </p>
      </div>

      {/* 성공 메시지 */}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">
                플랜이 성공적으로 생성되었습니다!
              </h3>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>총 {created}개의 플랜이 생성되었습니다.</li>
                {scoreBased && (
                  <li>성적 기반 배정이 적용되었습니다.</li>
                )}
                {weakSubjects > 0 && (
                  <li>{weakSubjects}개의 취약과목이 배정되었습니다.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <AutoScheduleForm />
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href="/plan"
          className="inline-flex items-center justify-center rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          플랜 목록 보기 →
        </Link>
      </div>

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          자동 스케줄러 동작 방식
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>등록된 시간 블록과 콘텐츠를 기반으로 학습 플랜을 자동 생성합니다.</li>
          <li>
            <strong>진행 중 콘텐츠(진행률 &lt; 100%)</strong>를 우선적으로 배정합니다.
          </li>
          <li>
            <strong>성적 기반 배정</strong>을 활성화하면 성적 데이터를 분석하여 취약과목을
            우선 배정합니다.
          </li>
          <li>
            콘텐츠 정렬 우선순위: <strong>1) Priority Score</strong> (종합 점수) → 2) 완성도 → 3) 난이도 →
            4) 학습 속도
          </li>
          <li>
            <strong>Priority Score</strong>는 Risk Index(35%), 성적 요소(25%), 진행률(15%), 난이도(10%), 시험 임박도(10%), 기타(5%)를 종합하여 계산합니다.
          </li>
          <li>
            취약과목 집중 모드를 활성화하면 Risk Score 30 이상인 과목만 배정됩니다.
          </li>
          <li>
            취약과목은 최소 하루 1블록 이상 배정되어 학습 기회를 보장합니다.
          </li>
          <li>
            시험 임박도 반영 옵션을 활성화하면 다가오는 시험일이 가까운 과목을 우선 배정합니다.
          </li>
          <li>각 블록마다 적절한 학습 분량(페이지/시간)을 자동 계산합니다.</li>
          <li>
            기존 플랜 충돌 시 덮어쓰기 또는 비어있는 블록만 생성 모드를 선택할 수
            있습니다.
          </li>
          <li>연속 블록에 동일 콘텐츠 배정 옵션으로 학습 연속성을 유지할 수 있습니다.</li>
        </ul>
      </div>
    </section>
  );
}

