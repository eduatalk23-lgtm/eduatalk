import { redirect } from "next/navigation";
import { saveStudentInfo } from "@/app/actions/student";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FormInput from "@/components/ui/FormInput";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

export default async function StudentSetupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("name, grade, class, birth_date")
    .eq("id", user.id)
    .single();

  // 회원가입 시 입력한 이름을 기본값으로 사용
  const defaultName =
    student?.name ?? (user.user_metadata?.display_name as string | undefined) ?? "";

  return (
    <section className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold">학생 정보 설정</h1>

      <form action={saveStudentInfo} className="flex flex-col gap-4">
        <FormInput
          label="이름"
          name="name"
          type="text"
          required
          defaultValue={defaultName}
        />

        <FormInput
          label="학년"
          name="grade"
          type="text"
          required
          defaultValue={student?.grade ?? ""}
        />

        <FormInput
          label="반"
          name="class"
          type="text"
          required
          defaultValue={student?.class ?? ""}
        />

        <FormInput
          label="생년월일"
          name="birth_date"
          type="date"
          required
          defaultValue={student?.birth_date ?? ""}
        />

        <FormSubmitButton defaultText="저장하기" />
      </form>
    </section>
  );
}
