"use client";

import Link from "next/link";
import { Suspense, useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { signUp } from "@/lib/domains/auth/actions";
import { getTenantOptionsForSignup, type TenantOption } from "@/lib/domains/tenant";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";
import FormInput from "@/components/ui/FormInput";
import FormPasswordInput from "@/components/ui/FormPasswordInput";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import FormCheckbox from "@/components/ui/FormCheckbox";
import { RoleSelectCards } from "@/components/ui/RoleSelectCards";
import { TermsModal } from "./_components/TermsModal";

const initialState: ActionResponse<{ redirect: string }> | null = null;

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [state, formAction] = useActionState<ActionResponse<{ redirect: string }> | null, FormData>(
    signUp,
    initialState
  );
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "parent" | "">("");
  const [selectedRelation, setSelectedRelation] = useState<"father" | "mother" | "guardian" | "">("");
  const [connectionCode, setConnectionCode] = useState(codeFromUrl);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // 로그인 링크에 연결 코드 유지
  const loginUrl = codeFromUrl ? `/login?code=${codeFromUrl}` : "/login";
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
          <Link href={loginUrl} className="text-black underline">
            로그인
          </Link>
          해주세요.
        </p>
      </div>

      <form
        action={(formData) => {
          // 비밀번호 일치 검증
          if (password !== confirmPassword) {
            setPasswordError("비밀번호가 일치하지 않습니다.");
            return;
          }
          setPasswordError("");
          formAction(formData);
        }}
        className="flex flex-col gap-4"
      >
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

        <FormPasswordInput
          label="비밀번호"
          name="password"
          required
          placeholder="최소 8자 이상"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            // 비밀번호 변경 시 에러 초기화
            if (passwordError) setPasswordError("");
          }}
          showStrengthIndicator
          showChecklist
        />

        <FormPasswordInput
          label="비밀번호 확인"
          name="confirmPassword"
          required
          placeholder="비밀번호를 다시 입력하세요"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            // 비밀번호 확인 변경 시 에러 초기화
            if (passwordError) setPasswordError("");
          }}
          error={passwordError}
        />

        {/* 기관 선택 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="tenant_search" className="text-sm font-medium text-gray-700">
            소속 기관 <span className="text-red-500">*</span>
          </label>
          {loadingTenants ? (
            <div className="text-sm text-gray-500">기관 목록을 불러오는 중...</div>
          ) : tenants.length === 0 ? (
            <div className="text-sm text-red-500">
              등록된 기관이 없습니다. 관리자에게 문의하세요.
            </div>
          ) : (
            <div className="relative">
              <input
                id="tenant_search"
                type="text"
                placeholder="기관명 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsDropdownOpen(false), 150);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
              />
              {/* 커스텀 드롭다운 */}
              {isDropdownOpen && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredTenants.length === 0 ? (
                    <li className="px-4 py-2 text-sm text-gray-500">
                      검색 결과가 없습니다
                    </li>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <li
                        key={tenant.id}
                        onClick={() => {
                          setSelectedTenantId(tenant.id);
                          setSearchQuery(tenant.name);
                          setIsDropdownOpen(false);
                        }}
                        className={`cursor-pointer px-4 py-2 text-sm hover:bg-gray-100 ${
                          selectedTenantId === tenant.id ? "bg-blue-50 text-blue-700" : ""
                        }`}
                      >
                        {tenant.name}
                        {tenant.type && (
                          <span className="ml-2 text-gray-400">({tenant.type})</span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
              {/* 선택 완료 표시 */}
              {selectedTenantId && !isDropdownOpen && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ 선택됨
                </p>
              )}
              {/* 실제 전송되는 hidden input */}
              <input type="hidden" name="tenant_id" value={selectedTenantId} required />
            </div>
          )}
        </div>

        {/* 권한 선택 */}
        <RoleSelectCards
          value={selectedRole}
          onChange={(role) => {
            setSelectedRole(role);
            if (role === "student") {
              setSelectedRelation("");
            }
          }}
          relation={selectedRelation}
          onRelationChange={(relation) => setSelectedRelation(relation)}
        />

        {/* 핸드폰 번호 입력 */}
        {selectedRole && (
          <FormInput
            label="핸드폰 번호"
            name="phone"
            type="tel"
            placeholder="010-0000-0000"
          />
        )}

        {/* 초대 코드 입력 (학생/학부모 모두) */}
        {selectedRole && (
          <div className="flex flex-col gap-2">
            <label htmlFor="connection_code" className="text-sm font-medium text-gray-700">
              초대 코드 <span className="text-gray-500">(선택사항)</span>
            </label>
            <input
              id="connection_code"
              name="connection_code"
              type="text"
              value={connectionCode}
              onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
              placeholder="INV-XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm uppercase"
            />
            <p className="text-xs text-gray-500">
              {selectedRole === "student"
                ? "관리자가 발급한 초대 코드가 있다면 입력하세요. 기존 학생 정보와 계정이 자동으로 연결됩니다."
                : "자녀의 초대 코드가 있다면 입력하세요. 자녀 계정과 자동으로 연결됩니다."}
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

function LoadingFallback() {
  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="text-center text-gray-500">로딩 중...</div>
    </section>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignupContent />
    </Suspense>
  );
}
