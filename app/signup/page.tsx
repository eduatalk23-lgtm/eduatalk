"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { signUp } from "@/app/actions/auth";
import FormInput from "@/components/ui/FormInput";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";

type SignupState = {
  error?: string;
  message?: string;
  redirect?: string;
};

const initialState: SignupState = { error: "", message: "" };

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction] = useActionState<SignupState, FormData>(
    signUp,
    initialState
  );

  // 회원가입 성공 시 리다이렉트
  useEffect(() => {
    if (state?.redirect && state?.message && !state?.error) {
      const timer = setTimeout(() => {
        router.push(`${state.redirect}?message=${encodeURIComponent(state.message!)}`);
      }, 500); // 짧은 딜레이로 메시지 표시 후 리다이렉트
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-semibold">회원가입</h1>
        <p className="text-sm text-neutral-500">
          이미 계정이 있다면{" "}
          <Link href="/login" className="text-black underline">
            로그인
          </Link>
          해주세요.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <FormInput
          label="표시 이름"
          name="displayName"
          type="text"
          required
          placeholder="홍길동"
        />

        <FormInput
          label="이메일"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
        />

        <FormInput
          label="비밀번호"
          name="password"
          type="password"
          required
          placeholder="최소 6자 이상"
        />

        {state?.error && <FormMessage type="error" message={state.error} />}

        {state?.message && !state.error && (
          <FormMessage type="success" message={state.message} />
        )}

        <FormSubmitButton
          defaultText="회원가입"
          pendingText="회원가입 중..."
        />
      </form>
    </section>
  );
}

