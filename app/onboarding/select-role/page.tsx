"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setupOAuthUserRole } from "@/lib/domains/auth/actions";
import { getTenantOptionsForSignup, type TenantOption } from "@/lib/domains/tenant";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { isSuccessResponse, isErrorResponse } from "@/lib/types/actionResponse";
import FormInput from "@/components/ui/FormInput";
import FormMessage from "@/components/ui/FormMessage";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import FormCheckbox from "@/components/ui/FormCheckbox";
import { RoleSelectCards } from "@/components/ui/RoleSelectCards";

const initialState: ActionResponse<{ redirect: string }> | null = null;

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [state, formAction] = useActionState(setupOAuthUserRole, initialState);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"student" | "parent" | "">("");
  const [selectedRelation, setSelectedRelation] = useState<"father" | "mother" | "guardian" | "">("");
  const [connectionCode, setConnectionCode] = useState(codeFromUrl);

  // localStorage에서 연결 코드 읽기 (OAuth 플로우에서 전달된 경우)
  useEffect(() => {
    if (!codeFromUrl) {
      const storedCode = localStorage.getItem("signup_connection_code");
      if (storedCode) {
        setConnectionCode(storedCode);
        // 사용 후 삭제
        localStorage.removeItem("signup_connection_code");
      }
    } else {
      // URL에 코드가 있으면 localStorage 정리
      localStorage.removeItem("signup_connection_code");
    }
  }, [codeFromUrl]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserInfo({
        email: user.email || "",
        name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        avatarUrl: user.user_metadata?.avatar_url || null,
      });
      setLoading(false);
    };

    loadUser();
  }, [router]);

  // 기관 목록 로드
  useEffect(() => {
    const loadTenants = async () => {
      try {
        const response = await getTenantOptionsForSignup();
        if (isSuccessResponse(response)) {
          setTenants(response.data || []);
        }
      } catch (error) {
        console.error("[select-role] 기관 목록 로드 실패:", error);
      } finally {
        setLoadingTenants(false);
      }
    };

    loadTenants();
  }, []);

  // 성공 시 리다이렉트
  useEffect(() => {
    if (state && isSuccessResponse(state) && state.data?.redirect) {
      // 하드 네비게이션으로 전체 페이지 새로고침 (auth 캐시 동기화 보장)
      window.location.href = state.data.redirect;
    }
  }, [state]);

  // 검색 필터링
  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <div className="text-center text-gray-500">로딩 중...</div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold">회원 정보 설정</h1>
        <p className="mt-2 text-sm text-neutral-500">
          서비스 이용을 위해 추가 정보를 입력해주세요.
        </p>
      </div>

      {/* 사용자 정보 표시 */}
      {userInfo && (
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
          {userInfo.avatarUrl ? (
            <img
              src={userInfo.avatarUrl}
              alt="프로필"
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium">{userInfo.name || "사용자"}</p>
            <p className="text-sm text-gray-500">{userInfo.email}</p>
          </div>
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <FormInput
          label="표시 이름"
          name="displayName"
          type="text"
          required
          placeholder="홍길동"
          defaultValue={userInfo?.name || ""}
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
                  // 드롭다운 항목 클릭을 위해 약간의 딜레이
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

        {/* 역할 선택 */}
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

        {/* 연결 코드 입력 (학생/학부모 모두) */}
        {selectedRole && (
          <div className="flex flex-col gap-2">
            <label htmlFor="connection_code" className="text-sm font-medium text-gray-700">
              연결 코드 <span className="text-gray-500">(선택사항)</span>
            </label>
            <input
              id="connection_code"
              name="connection_code"
              type="text"
              value={connectionCode}
              onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
              placeholder="STU-XXXX-XXXX"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm uppercase"
            />
            <p className="text-xs text-gray-500">
              {selectedRole === "student"
                ? "관리자가 발급한 연결 코드가 있다면 입력하세요. 기존 학생 정보와 계정이 자동으로 연결됩니다."
                : "자녀의 연결 코드가 있다면 입력하세요. 자녀 계정과 자동으로 연결됩니다."}
            </p>
          </div>
        )}

        {/* 약관 동의 */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900">약관 동의</h3>
          <div className="flex flex-col gap-3">
            <FormCheckbox
              name="consent_terms"
              required
              label={
                <>
                  이용약관에 동의합니다 <span className="text-red-500">(필수)</span>
                </>
              }
            />
            <FormCheckbox
              name="consent_privacy"
              required
              label={
                <>
                  개인정보취급방침에 동의합니다 <span className="text-red-500">(필수)</span>
                </>
              }
            />
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
          defaultText="시작하기"
          pendingText="처리 중..."
        />
      </form>

      {/* 로그인 페이지로 돌아가기 */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={async () => {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          다른 계정으로 로그인
        </button>
      </div>
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

export default function SelectRolePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SelectRoleContent />
    </Suspense>
  );
}
