"use client";

import { useState, useEffect } from "react";
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectCategories,
  getCurriculumRevisions,
  type Subject,
  type SubjectCategory,
  type CurriculumRevision,
} from "@/lib/data/contentMetadata";

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
    loadItems();
  }, []);

  useEffect(() => {
    if (selectedRevisionId) {
      loadSubjectCategories(selectedRevisionId);
    } else {
      setSubjectCategories([]);
    }
  }, [selectedRevisionId]);

  async function loadRevisions() {
    try {
      const data = await getCurriculumRevisions();
      setRevisions(data);
      if (data.length > 0 && !selectedRevisionId) {
        setSelectedRevisionId(data[0].id);
      }
    } catch (error) {
      console.error("개정교육과정 조회 실패:", error);
    }
  }

  async function loadSubjectCategories(revisionId: string) {
    try {
      const data = await getSubjectCategories(revisionId);
      setSubjectCategories(data);
      if (data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(data[0].id);
      }
    } catch (error) {
      console.error("교과 조회 실패:", error);
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const data = await getSubjects();
      setItems(data);
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
      await createSubject(selectedCategoryId, formData.name, formData.display_order);
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
      await updateSubject(id, {
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
      await deleteSubject(id);
      loadItems();
    } catch (error) {
      console.error("과목 삭제 실패:", error);
      alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  function startEdit(item: Subject) {
    setEditingId(item.id);
    setFormData({ name: item.name, display_order: item.display_order });
    if (item.subject_category) {
      setSelectedRevisionId(item.subject_category.revision_id);
      setSelectedCategoryId(item.subject_category_id);
    }
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: "", display_order: 0 });
  }

  const filteredItems = selectedCategoryId
    ? items.filter((item) => item.subject_category_id === selectedCategoryId)
    : selectedRevisionId
      ? items.filter(
          (item) => item.subject_category?.revision_id === selectedRevisionId
        )
      : items;

  if (loading) {
    return <div className="text-center py-8 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">과목 관리</h2>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            setFormData({ name: "", display_order: 0 });
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          + 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              개정교육과정 필터
            </label>
            <select
              value={selectedRevisionId}
              onChange={(e) => {
                setSelectedRevisionId(e.target.value);
                setSelectedCategoryId("");
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {revisions.map((rev) => (
                <option key={rev.id} value={rev.id}>
                  {rev.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">교과 필터</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                개정교육과정 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedRevisionId}
                onChange={(e) => {
                  setSelectedRevisionId(e.target.value);
                  setSelectedCategoryId("");
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택하세요</option>
                {revisions.map((rev) => (
                  <option key={rev.id} value={rev.id}>
                    {rev.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                교과 <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 화법과 작문"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">정렬 순서</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  저장
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                개정교육과정
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                교과
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                정렬 순서
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                상태
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.subject_category?.revision?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.subject_category?.name || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.is_active}
                          onChange={(e) =>
                            updateSubject(item.id, { is_active: e.target.checked }).then(() =>
                              loadItems()
                            )
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          {item.is_active ? "활성" : "비활성"}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(item.id)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          저장
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.subject_category?.revision?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.subject_category?.name || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.display_order}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          item.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {item.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
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

