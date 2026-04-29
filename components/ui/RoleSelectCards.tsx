"use client";

type Role = "student" | "parent" | "";
type Relation = "father" | "mother" | "guardian" | "";

type RoleSelectCardsProps = {
  value: Role;
  onChange: (role: "student" | "parent") => void;
  relation?: Relation;
  onRelationChange?: (relation: "father" | "mother" | "guardian") => void;
};

export function RoleSelectCards({
  value,
  onChange,
  relation = "",
  onRelationChange
}: RoleSelectCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-[var(--text-secondary)]">
        회원 유형 <span className="text-[rgb(var(--color-error-500))]">*</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* 학생 카드 */}
        <button
          type="button"
          onClick={() => onChange("student")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            value === "student"
              ? "border-[rgb(var(--color-info-500))] bg-[rgb(var(--color-info-50))]"
              : "border-[rgb(var(--color-secondary-200))] bg-[var(--background)] hover:border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-50))]"
          }`}
        >
          {value === "student" && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--color-info-500))] text-white">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <div className="text-3xl">📚</div>
          <div className="text-base font-semibold text-[var(--text-primary)]">학생</div>
          <div className="text-center text-xs text-[var(--text-tertiary)]">
            학습 계획 관리<br />성적 및 분석
          </div>
        </button>

        {/* 학부모 카드 */}
        <button
          type="button"
          onClick={() => onChange("parent")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            value === "parent"
              ? "border-[rgb(var(--color-info-500))] bg-[rgb(var(--color-info-50))]"
              : "border-[rgb(var(--color-secondary-200))] bg-[var(--background)] hover:border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-50))]"
          }`}
        >
          {value === "parent" && (
            <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--color-info-500))] text-white">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          <div className="text-3xl">👨‍👩‍👧</div>
          <div className="text-base font-semibold text-[var(--text-primary)]">학부모</div>
          <div className="text-center text-xs text-[var(--text-tertiary)]">
            자녀 학습 현황 확인<br />학습 리포트 수신
          </div>
        </button>
      </div>

      {/* 학부모 선택 시 관계 선택 */}
      {value === "parent" && onRelationChange && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            자녀와의 관계 <span className="text-[rgb(var(--color-error-500))]">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "father", label: "부" },
              { value: "mother", label: "모" },
              { value: "guardian", label: "기타" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onRelationChange(item.value as "father" | "mother" | "guardian")}
                className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                  relation === item.value
                    ? "border-[rgb(var(--color-info-500))] bg-[rgb(var(--color-info-50))] text-[rgb(var(--color-info-700))]"
                    : "border-[rgb(var(--color-secondary-200))] bg-[var(--background)] text-[var(--text-secondary)] hover:border-[rgb(var(--color-secondary-300))] hover:bg-[rgb(var(--color-secondary-50))]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* hidden inputs for form submission */}
      <input type="hidden" name="role" value={value} required />
      {value === "parent" && (
        <input type="hidden" name="relation" value={relation} required />
      )}
    </div>
  );
}
