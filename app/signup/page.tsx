"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { signUp } from "@/app/actions/auth";
import { getTenantOptionsForSignup } from "@/app/actions/tenants";
import type { TenantOption } from "@/app/actions/tenants";
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
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "parent" | "">("");

  // 기관 목록 로드
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const data = await getTenantOptionsForSignup();
        if (data.length === 0) {
          console.warn("[signup] 등록된 기관이 없습니다.");
        }
        setTenants(data);
      } catch (error) {
        console.error("[signup] 기관 목록 로드 실패:", error);
        // 에러 발생 시 빈 배열로 설정하여 UI가 적절히 표시되도록 함
        setTenants([]);
      } finally {
        setLoadingTenants(false);
      }
    };

    loadTenants();
  }, []);

  // 회원가입 성공 시 리다이렉트
  useEffect(() => {
    if (state?.redirect && state?.message && !state?.error) {
      const timer = setTimeout(() => {
        router.push(`${state.redirect}?message=${encodeURIComponent(state.message!)}`);
      }, 500); // 짧은 딜레이로 메시지 표시 후 리다이렉트
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  // 검색 필터링
  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        {/* 기관 선택 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="tenant_id" className="text-sm font-medium text-gray-700">
            소속 기관 <span className="text-red-500">*</span>
          </label>
          {loadingTenants ? (
            <div className="text-sm text-gray-500">기관 목록을 불러오는 중...</div>
          ) : tenants.length === 0 ? (
            <div className="text-sm text-red-500">
              등록된 기관이 없습니다. 관리자에게 문의하세요.
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="기관명으로 검색... (선택사항)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // 검색 시 선택 해제
                  if (e.target.value && !filteredTenants.find(t => t.id === selectedTenantId)) {
                    setSelectedTenantId("");
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              />
              <select
                id="tenant_id"
                name="tenant_id"
                required
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                <option value="">기관을 선택하세요</option>
                {filteredTenants.length === 0 ? (
                  <option value="" disabled>
                    {searchQuery ? "검색 결과가 없습니다" : "기관이 없습니다"}
                  </option>
                ) : (
                  filteredTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} {tenant.type ? `(${tenant.type})` : ""}
                    </option>
                  ))
                )}
              </select>
              {searchQuery && filteredTenants.length === 0 && (
                <p className="text-xs text-gray-500">
                  검색 결과가 없습니다. 검색어를 지우고 다시 시도해보세요.
                </p>
              )}
              {tenants.length > 0 && (
                <p className="text-xs text-gray-500">
                  총 {tenants.length}개의 기관이 등록되어 있습니다.
                </p>
              )}
            </>
          )}
        </div>

        {/* 권한 선택 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="role" className="text-sm font-medium text-gray-700">
            회원 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id="role"
            name="role"
            required
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as "student" | "parent")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
          >
            <option value="">회원 유형을 선택하세요</option>
            <option value="student">학생</option>
            <option value="parent">학부모</option>
          </select>
          <p className="text-xs text-gray-500">
            학생: 학습 계획 및 성적 관리를 사용합니다. 학부모: 자녀의 학습 현황을 확인합니다.
          </p>
        </div>

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

