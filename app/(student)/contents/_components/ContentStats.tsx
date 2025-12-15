import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/molecules/StatCard";
import { Book, Headphones, FileText, Link2 } from "lucide-react";

type ContentStatsProps = {
  studentId: string;
};

export async function ContentStats({ studentId }: ContentStatsProps) {
  const supabase = await createSupabaseServerClient();

  // 교재 통계
  const { count: bookCount } = await supabase
    .from("books")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  // 강의 통계
  const { count: lectureCount } = await supabase
    .from("lectures")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  // 연결된 교재가 있는 강의 수
  const { count: linkedLectureCount } = await supabase
    .from("lectures")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId)
    .not("linked_book_id", "is", null);

  // 커스텀 콘텐츠 통계
  const { count: customContentCount } = await supabase
    .from("student_custom_contents")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="총 교재"
        value={bookCount ?? 0}
        color="indigo"
        icon={<Book size={24} className="text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
      />
      <StatCard
        label="총 강의"
        value={lectureCount ?? 0}
        color="purple"
        icon={<Headphones size={24} className="text-purple-600 dark:text-purple-400" aria-hidden="true" />}
      />
      <StatCard
        label="커스텀 콘텐츠"
        value={customContentCount ?? 0}
        color="emerald"
        icon={<FileText size={24} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
      />
      <StatCard
        label="연결된 교재"
        value={linkedLectureCount ?? 0}
        color="green"
        icon={<Link2 size={24} className="text-green-600 dark:text-green-400" aria-hidden="true" />}
      />
    </div>
  );
}

