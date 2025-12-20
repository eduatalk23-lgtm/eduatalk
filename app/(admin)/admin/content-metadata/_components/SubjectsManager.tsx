"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";
import Input from "@/components/atoms/Input";
import {
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
  getCurriculumRevisionsAction,
} from "@/app/(admin)/actions/contentMetadataActions";
import {
  getSubjectGroupsAction,
  getSubjectsByGroupAction,
} from "@/app/(admin)/actions/subjectActions";
import type { Subject, SubjectCategory, CurriculumRevision } from "@/lib/data/contentMetadata";
import {
  bgSurfaceVar,
  borderDefaultVar,
  divideDefaultVar,
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  inputBaseStyle,
  inlineButtonPrimary,
  inlineButtonOutline,
  warningMessageStyles,
  getStatusBadgeColorClasses,
} from "@/lib/utils/darkMode";

export function SubjectsManager() {
  const [items, setItems] = useState<Subject[]>([]);
  const [subjectCategories, setSubjectCategories] = useState<SubjectCategory[]>([]);
  const [revisions, setRevisions] = useState<CurriculumRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", display_order: 0 });

  useEffect(() => {
    loadRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRevisionId) {
      loadSubjectCategories(selectedRevisionId);
    } else {
      setSubjectCategories([]);
      setSelectedCategoryId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRevisionId]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadItems();
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

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

  async function loadSubjectCategories(revisionId: string) {
    try {
      // getSubjectGroupsAction 사용 (deprecated getSubjectCategoriesAction 대체)
      const data = await getSubjectGroupsAction(revisionId);
      // SubjectGroup을 SubjectCategory 형태로 변환
      const categories = data.map((group) => ({
        id: group.id,
        name: group.name,
        display_order: group.display_order ?? 0,
        is_active: true,
      }));
      setSubjectCategories(categories);
      if (categories.length > 0 && !selectedCategoryId) {
        const firstCategory = categories[0];
        if (firstCategory?.id) {
          setSelectedCategoryId(firstCategory.id);
        }
      }
    } catch (error) {
      console.error("교과 조회 실패:", error);
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      // selectedCategoryId가 있을 때만 조회
      if (!selectedCategoryId) {
        setItems([]);
        setLoading(false);
        return;
      }
      // getSubjectsByGroupAction 사용 (deprecated getSubjectsAction 대체)
      const data = await getSubjectsByGroupAction(selectedCategoryId);
      // Subject를 Subject 형태로 변환 (이미 호환 가능)
      const subjects = data.map((subject) => ({
        id: subject.id,
        name: subject.name,
        subject_category_id: subject.subject_group_id,
        display_order: subject.display_order ?? 0,
        is_active: true,
      }));
      setItems(subjects);
    } catch (error) {
      console.error("과목 조회 실패:", error);
      alert("과목을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!selectedCategoryId) {
      alert("교과를 선택해주세요.");
      return;
    }

    try {
      await createSubjectAction(selectedCategoryId, formData.name, formData.display_order);
      setFormData({ name: "", display_order: 0 });
      setIsCreating(false);
      loadItems();
    } catch (error) {
      console.error("과목 생성 실패:", error);
      alert(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdate(id: string) {
    if (!formData.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    try {
      await updateSubjectAction(id, {
        name: formData.name,
        display_order: formData.display_order,
      });
      setEditingId(null);
      setFormData({ name: "", display_order: 0 });
      loadItems();
    } catch (error) {
      console.error("과목 수정 실패:", error);
      alert(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteSubjectAction(id);
      loadItems();
    } catch (error) {
      console.error("과목 삭제 실패:", error);
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  function startEdit(item: Subject) {
    setEditingId(item.id);
    setFormData({ name: item.name, display_order: item.display_order ?? 0 });
    if (item.subject_category_id) {
      setSelectedCategoryId(item.subject_category_id);
    }
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: "", display_order: 0 });
  }

  // Subject에는 subject_category_id만 있으므로 category로만 필터링
  // TODO: revision_id 관계가 추가되면 revision 필터링 로직 구현
  const filteredItems = selectedCategoryId
    ? items.filter((item) => item.subject_category_id === selectedCategoryId)
    : items;

  if (loading) {
    return <div className={cn("text-center py-8", textSecondaryVar)}>로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 경고 메시지 */}
      <div className={warningMessageStyles.container}>
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 dark:text-yellow-400">⚠️</div>
          <div className="flex flex-1 flex-col gap-1">
            <h3 className={warningMessageStyles.title}>주의</h3>
            <p className={warningMessageStyles.text}>
              이 페이지는 deprecated된 테이블을 사용합니다. 과목 관리는{" "}
              <a
                href="/admin/subjects"
                className={warningMessageStyles.link}
              >
                교과/과목 관리 페이지
              </a>
              에서 진행해주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-semibold", textPrimaryVar)}>과목 관리</h2>
        <Button
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            setFormData({ name: "", display_order: 0 });
          }}
          variant="primary"
          size="sm"
        >
          + 추가
        </Button>
      </div>

      {/* 필터 */}
      <div className={cn("rounded-lg border p-4", bgSurfaceVar, borderDefaultVar)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className={cn("block text-sm font-medium", textSecondaryVar)}>
              개정교육과정 필터
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                setSelectedRevisionId(e.target.value);
                setSelectedCategoryId("");
              }}
              className={inputBaseStyle()}
            >
              <option value="">전체</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className={cn("block text-sm font-medium", textSecondaryVar)}>교과 필터</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className={inputBaseStyle()}
              disabled={!selectedRevisionId}
            >
              <option value="">전체</option>
              {subjectCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 생성 폼 */}
      {isCreating && (
        <div className={cn("rounded-lg border p-4", bgSurfaceVar, borderDefaultVar)}>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className={cn("block text-sm font-medium", textSecondaryVar)}>
                개정교육과정 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedRevisionId}
                onChange={(e) => {
                  setSelectedRevisionId(e.target.value);
                  setSelectedCategoryId("");
                }}
                className={inputBaseStyle()}
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
              <label className={cn("block text-sm font-medium", textSecondaryVar)}>
                교과 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className={inputBaseStyle()}
                disabled={!selectedRevisionId}
              >
                <option value="">선택하세요</option>
                {subjectCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn("block text-sm font-medium", textSecondaryVar)}>이름</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 화법과 작문"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label className={cn("block text-sm font-medium", textSecondaryVar)}>정렬 순서</label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} variant="primary" size="sm">
                  저장
                </Button>
                <Button onClick={cancelEdit} variant="outline" size="sm">
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className={cn("rounded-lg border overflow-hidden", bgSurfaceVar, borderDefaultVar)}>
        <table className="min-w-full divide-y" style={{ borderColor: "rgb(var(--color-secondary-200))" }}>
          <thead className="bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
            <tr>
              <th className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                개정교육과정
              </th>
              <th className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                교과
              </th>
              <th className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                이름
              </th>
              <th className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                정렬 순서
              </th>
              <th className={cn("px-6 py-3 text-left text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                상태
              </th>
              <th className={cn("px-6 py-3 text-right text-xs font-medium uppercase tracking-wider", textTertiaryVar)}>
                작업
              </th>
            </tr>
          </thead>
          <tbody className={cn("divide-y", divideDefaultVar, bgSurfaceVar)}>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className={cn("px-6 py-8 text-center text-sm", textSecondaryVar)}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td className={cn("px-6 py-4 text-sm", textSecondaryVar)}>
                      -
                    </td>
                    <td className={cn("px-6 py-4 text-sm", textSecondaryVar)}>
                      -
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(e) =>
                            updateSubjectAction(item.id, { is_active: e.target.checked }).then(() =>
                              loadItems()
                            )
                          }
                          className="rounded border-gray-300 dark:border-gray-700"
                        />
                        <span className={cn("text-sm", textSecondaryVar)}>
                          {item.is_active ? "활성" : "비활성"}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => handleUpdate(item.id)}
                          variant="primary"
                          size="xs"
                        >
                          저장
                        </Button>
                        <Button
                          onClick={cancelEdit}
                          variant="outline"
                          size="xs"
                        >
                          취소
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td className={cn("px-6 py-4 text-sm", textSecondaryVar)}>
                      -
                    </td>
                    <td className={cn("px-6 py-4 text-sm", textSecondaryVar)}>
                      -
                    </td>
                    <td className={cn("px-6 py-4 text-sm font-medium", textPrimaryVar)}>{item.name}</td>
                    <td className={cn("px-6 py-4 text-sm", textTertiaryVar)}>{item.display_order}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          getStatusBadgeColorClasses(item.is_active ? "success" : "inactive")
                        )}
                      >
                        {item.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => startEdit(item)}
                          variant="primary"
                          size="xs"
                        >
                          수정
                        </Button>
                        <Button
                          onClick={() => handleDelete(item.id)}
                          variant="destructive"
                          size="xs"
                        >
                          삭제
                        </Button>
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

