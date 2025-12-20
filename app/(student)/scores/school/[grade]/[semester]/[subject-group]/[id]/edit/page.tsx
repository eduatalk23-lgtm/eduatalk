import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    grade: string;
    semester: string;
    "subject-group": string;
    id: string;
  }>;
};

/**
 * @deprecated 이 페이지는 더 이상 사용되지 않습니다.
 * 성적 수정은 모달(ScoreFormModal)을 통해 수행됩니다.
 * 기존 링크를 위한 리다이렉트 처리입니다.
 */
export default async function EditSchoolScorePage({ params }: PageProps) {
  const { grade, semester, "subject-group": subjectGroupRaw } = await params;
  const subjectGroup = decodeURIComponent(subjectGroupRaw);
  
  // 리스트 페이지로 리다이렉트 (모달을 통한 편집은 리스트 페이지에서 수행)
  redirect(`/scores/school/${grade}/${semester}`);
}

