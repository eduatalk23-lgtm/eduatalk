"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { signUp } from "@/app/actions/auth";
import { getTenantOptionsForSignup } from "@/app/actions/tenants";
import type { TenantOption } from "@/app/actions/tenants";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";
import FormInput from "@/components/ui/FormInput";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import FormCheckbox from "@/components/ui/FormCheckbox";
import { TermsModal } from "./_components/TermsModal";

const initialState: ActionResponse<{ redirect: string }> | null = null;

export default function SignupPage() {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResponse<{ redirect: string }> | null, FormData>(
    signUp,
    initialState
  );
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "parent" | "">("");
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [marketingModalOpen, setMarketingModalOpen] = useState(false);

  // 기관 목록 로드
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const response = await getTenantOptionsForSignup();
        if (isSuccessResponse(response)) {
          const data = response.data || [];
          if (data.length === 0) {
            console.warn("[signup] 등록된 기관이 없습니다.");
          }
          setTenants(data);
        } else {
          console.error("[signup] 기관 목록 로드 실패:", response.error);
          setTenants([]);
        }
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
    if (state && isSuccessResponse(state) && state.data?.redirect) {
      const redirectPath = state.data.redirect;
      const timer = setTimeout(() => {
        // redirect URL에 이미 쿼리 파라미터가 있으면 & 사용, 없으면 ? 사용
        const separator = redirectPath.includes("?") ? "&" : "?";
        const redirectUrl = state.message
          ? `${redirectPath}${separator}message=${encodeURIComponent(state.message)}`
          : redirectPath;
        router.push(redirectUrl);
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

        {/* 연결 코드 입력 (학생만) */}
        {selectedRole === "student" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="connection_code" className="text-sm font-medium text-gray-700">
              학생 연결 코드 <span className="text-gray-500">(선택사항)</span>
            </label>
            <FormInput
              label=""
              name="connection_code"
              type="text"
              placeholder="STU-XXXX-XXXX"
              className="uppercase"
            />
            <p className="text-xs text-gray-500">
              관리자가 발급한 연결 코드가 있다면 입력하세요. 코드를 입력하면 기존 학생 정보와 계정이 자동으로 연결됩니다.
            </p>
          </div>
        )}

        {/* 약관 동의 */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900">약관 동의</h3>
          <div className="flex flex-col gap-3">
            {/* 이용약관 (필수) */}
            <FormCheckbox
              name="consent_terms"
              required
              label={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 underline"
                  >
                    이용약관
                  </button>
                  에 동의합니다 <span className="text-red-500">(필수)</span>
                </>
              }
            />

            {/* 개인정보취급방침 (필수) */}
            <FormCheckbox
              name="consent_privacy"
              required
              label={
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPrivacyModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 underline"
                  >
                    개인정보취급방침
                  </button>
                  에 동의합니다 <span className="text-red-500">(필수)</span>
                </>
              }
            />

            {/* 마케팅 활용 동의 (선택) */}
            <FormCheckbox
              name="consent_marketing"
              label={
                <>
                  마케팅 정보 수신에 동의합니다 <span className="text-gray-500">(선택)</span>
                </>
              }
            />
          </div>
        </div>

        {state && isErrorResponse(state) && state.error && (
          <FormMessage type="error" message={state.error} />
        )}

        {state && isSuccessResponse(state) && state.message && (
          <FormMessage type="success" message={state.message} />
        )}

        <FormSubmitButton
          defaultText="회원가입"
          pendingText="회원가입 중..."
        />
      </form>

      {/* 약관 모달 */}
      <TermsModal
        open={termsModalOpen}
        onOpenChange={setTermsModalOpen}
        contentType="terms"
        title="이용약관"
      />
      <TermsModal
        open={privacyModalOpen}
        onOpenChange={setPrivacyModalOpen}
        contentType="privacy"
        title="개인정보취급방침"
      />
      <TermsModal
        open={marketingModalOpen}
        onOpenChange={setMarketingModalOpen}
        contentType="marketing"
        title="마케팅 활용 동의"
      />
    </section>
  );
}

