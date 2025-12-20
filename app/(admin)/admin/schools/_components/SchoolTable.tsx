"use client";

// Read-Only 모드: 삭제 기능 제거됨
import type { School } from "@/lib/data/schools";
import { 
  bgSurface, 
  bgPage,
  borderDefault, 
  borderInput,
  textPrimary, 
  textSecondary,
  textTertiary,
  tableHeaderBase,
  tableCellBase,
  getGrayBgClasses,
  tableRowHover,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type SchoolTableProps = {
  schools: School[];
  onRefresh: () => void;
};

/**
 * 학교 테이블 컴포넌트 (Read-Only)
 * 
 * 학교 데이터는 외부 데이터 기반으로 읽기 전용입니다.
 * 수정/삭제 기능은 제거되었습니다.
 */
export default function SchoolTable({
  schools,
  onRefresh,
}: SchoolTableProps) {
  // 삭제 기능 제거됨 (Read-Only)

  // 타입별 속성 표시 텍스트 생성
  function getTypeAttribute(school: School): string {
    if (school.type === "고등학교" && school.category) {
      return school.category;
    } else if (school.type === "대학교") {
      const parts: string[] = [];
      if (school.university_type) parts.push(school.university_type);
      if (school.university_ownership) parts.push(school.university_ownership);
      return parts.length > 0 ? parts.join("/") : "—";
    }
    return "—";
  }

  if (schools.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed p-12 text-center", borderInput, bgPage)}>
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="text-6xl">🏫</div>
          <div className="flex flex-col gap-2">
            <h3 className={cn("text-lg font-semibold", textPrimary)}>
              검색 결과가 없습니다
            </h3>
            <p className={cn("text-sm", textSecondary)}>
              다른 검색 조건으로 시도해보세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className={cn("w-full border-collapse rounded-lg border", borderDefault, bgSurface)}>
          <thead className={cn(getGrayBgClasses("tableHeader"))}>
            <tr>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, textPrimary)}>
                순서
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                학교명
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                타입
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                유형
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                지역
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                주소
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                전화번호
              </th>
              <th className={cn("border-b px-4 py-3 text-left text-sm font-semibold", borderDefault, tableHeaderBase, textPrimary)}>
                등록일
              </th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school, index) => (
              <tr key={school.id} className={cn("transition-colors", tableRowHover)}>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {index + 1}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm font-medium", borderDefault, tableCellBase, textPrimary)}>
                  {school.name}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.type}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {getTypeAttribute(school)}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.region || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.address || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.phone || "—"}
                </td>
                <td className={cn("border-b px-4 py-3 text-sm", borderDefault, tableCellBase, textTertiary)}>
                  {school.created_at
                    ? new Date(school.created_at).toLocaleDateString("ko-KR")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

