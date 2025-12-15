"use client";

import { useState, useEffect } from "react";
import {
  getSubjectCategoriesAction,
  createSubjectCategoryAction,
  updateSubjectCategoryAction,
  deleteSubjectCategoryAction,
  getCurriculumRevisionsAction,
} from "@/app/(admin)/actions/contentMetadataActions";
import type { SubjectCategory, CurriculumRevision } from "@/lib/data/contentMetadata";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  textTertiary,
  bgSurface,
  borderDefault,
  borderInput,
  bgStyles,
  statusBadgeColors,
  tableHeaderBase,
  tableCellBase,
  tableContainer,
  divideDefault,
} from "@/lib/utils/darkMode";

export function SubjectCategoriesManager() {
  const [items, setItems] = useState<SubjectCategory[]>([]);
  const [revisions, setRevisions] = useState<CurriculumRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", display_order: 0 });

  useEffect(() => {
    loadRevisions();
    loadItems();
  }, []);

  async function loadRevisions() {
    try {
      const data = await getCurriculumRevisionsAction();
      setRevisions(data);
      if (data.length > 0 && !selectedRevisionId) {
        const firstRevision = data[0];
        if (firstRevision?.id) {
          setSelectedRevisionId(firstRevision.id);
        }
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const data = await getSubjectCategoriesAction();
      setItems(data);
    } catch (error) {
      console.error("교과 조회 실패:", error);
      alert("교과를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!selectedRevisionId) {
      alert("개정교육과정을 선택해주세요.");
      return;
    }

    try {
      await createSubjectCategoryAction(selectedRevisionId, formData.name, formData.display_order);
      setFormData({ name: "", display_order: 0 });
      setIsCreating(false);
      loadItems();
    } catch (error) {
      console.error("교과 생성 실패:", error);
      alert(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdate(id: string) {
    if (!formData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    try {
      await updateSubjectCategoryAction(id, {
        name: formData.name,
        display_order: formData.display_order,
      });
      setEditingId(null);
      setFormData({ name: "", display_order: 0 });
      loadItems();
    } catch (error) {
      console.error("교과 수정 실패:", error);
      alert(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteSubjectCategoryAction(id);
      loadItems();
    } catch (error) {
      console.error("교과 삭제 실패:", error);
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  function startEdit(item: SubjectCategory) {
    setEditingId(item.id);
    setFormData({ name: item.name, display_order: item.display_order ?? 0 });
    // revision_id는 SubjectCategory에 없으므로 현재 선택된 revision 사용
    // setSelectedRevisionId(item.revision_id);
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: "", display_order: 0 });
  }

  // SubjectCategory에는 revision_id가 없으므로 모든 항목 표시
  // TODO: 데이터베이스 스키마에 revision_id 관계가 추가되면 필터링 로직 구현
  const filteredItems = items;

  if (loading) {
    return <div className={cn("text-center py-8", textSecondary)}>로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 경고 메시지 */}
      <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 p-4">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-400">⚠️</div>
          <div className="flex flex-1 flex-col gap-1">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">주의</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              이 페이지는 deprecated된 테이블을 사용합니다. 교과 관리는{" "}
              <a
                href="/admin/subjects"
                className="font-semibold text-yellow-800 dark:text-yellow-200 underline hover:text-yellow-900 dark:hover:text-yellow-100"
              >
                교과/과목 관리 페이지
              </a>
              에서 진행해주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-semibold", textPrimary)}>교과 관리</h2>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            setFormData({ name: "", display_order: 0 });
          }}
          className="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
        >
          + 추가
        </button>
      </div>

      {/* 개정교육과정 필터 */}
      <div className={cn("flex flex-col gap-2 rounded-lg border p-4", borderDefault, bgSurface)}>
        <label className={cn("block text-sm font-medium", textSecondary)}>
          개정교육과정 필터
        </label>
        <select
          value={selectedRevisionId}
          onChange={(e) => setSelectedRevisionId(e.target.value)}
          className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
        >
          <option value="">전체</option>
          {revisions.map((rev) => (
            <option key={rev.id} value={rev.id}>
              {rev.name}
            </option>
          ))}
        </select>
      </div>

      {/* 생성 폼 */}
      {isCreating && (
        <div className={cn("rounded-lg border p-4", borderDefault, bgSurface)}>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className={cn("block text-sm font-medium", textSecondary)}>
                개정교육과정 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                value={selectedRevisionId}
                onChange={(e) => setSelectedRevisionId(e.target.value)}
                className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
              >
                <option value="">선택하세요</option>
                {revisions.map((rev) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("block text-sm font-medium", textSecondary)}>이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 국어"
                className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("block text-sm font-medium", textSecondary)}>정렬 순서</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleCreate}
                className="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
              >
                저장
              </button>
              <button
                onClick={cancelEdit}
                className={cn("rounded-lg border px-4 py-2 text-sm font-semibold transition", borderInput, bgSurface, textSecondary, "hover:bg-gray-50 dark:hover:bg-gray-700")}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className={cn("rounded-lg border overflow-hidden", borderDefault, bgSurface)}>
        <table className={cn("min-w-full", divideDefault)}>
          <thead className={bgStyles.gray}>
            <tr>
              <th className={cn(tableHeaderBase, "px-6")}>
                개정교육과정
              </th>
              <th className={cn(tableHeaderBase, "px-6")}>
                이름
              </th>
              <th className={cn(tableHeaderBase, "px-6")}>
                정렬 순서
              </th>
              <th className={cn(tableHeaderBase, "px-6")}>
                상태
              </th>
              <th className={cn(tableHeaderBase, "px-6 text-right")}>
                작업
              </th>
            </tr>
          </thead>
          <tbody className={cn(divideDefault, bgSurface)}>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className={cn(tableCellBase, "px-6 py-8 text-center text-sm", textSecondary)}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td className={cn(tableCellBase, "px-6 text-sm", textSecondary)}>
                      -
                    </td>
                    <td className={cn(tableCellBase, "px-6")}>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
                      />
                    </td>
                    <td className={cn(tableCellBase, "px-6")}>
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                        }
                        className={cn("w-full rounded-md border px-3 py-2 text-sm", borderInput, bgSurface, textPrimary)}
                      />
                    </td>
                    <td className={cn(tableCellBase, "px-6")}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(e) =>
                            updateSubjectCategoryAction(item.id, { is_active: e.target.checked }).then(
                              () => loadItems()
                            )
                          }
                          className={cn("rounded", borderInput)}
                        />
                        <span className={cn("text-sm", textSecondary)}>
                          {item.is_active ? "활성" : "비활성"}
                        </span>
                      </label>
                    </td>
                    <td className={cn(tableCellBase, "px-6 text-right")}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(item.id)}
                          className="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
                        >
                          저장
                        </button>
                        <button
                          onClick={cancelEdit}
                          className={cn("rounded-lg border px-3 py-1 text-xs font-semibold transition", borderInput, bgSurface, textSecondary, "hover:bg-gray-50 dark:hover:bg-gray-700")}
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td className={cn(tableCellBase, "px-6 text-sm", textSecondary)}>
                      -
                    </td>
                    <td className={cn(tableCellBase, "px-6 text-sm font-medium", textPrimary)}>{item.name}</td>
                    <td className={cn(tableCellBase, "px-6 text-sm", textTertiary)}>{item.display_order}</td>
                    <td className={cn(tableCellBase, "px-6")}>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          item.is_active ? statusBadgeColors.active : statusBadgeColors.inactive
                        )}
                      >
                        {item.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className={cn(tableCellBase, "px-6 text-right")}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700 dark:hover:bg-indigo-600"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg bg-red-600 dark:bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 dark:hover:bg-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

