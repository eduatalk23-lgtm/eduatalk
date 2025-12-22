"use client";

import { useState, useEffect } from "react";
import {
  getDifficultyLevelsAction,
  createDifficultyLevelAction,
  updateDifficultyLevelAction,
  deleteDifficultyLevelAction,
} from "@/lib/domains/content-metadata";
import type { DifficultyLevel } from "@/lib/data/difficultyLevels";
import { Badge } from "@/components/atoms";
import { useToast } from "@/components/ui/ToastProvider";

type ContentType = "book" | "lecture" | "custom" | "common";

export function DifficultyLevelsManager() {
  const toast = useToast();
  const [items, setItems] = useState<DifficultyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<ContentType | "all">("all");
  const [formData, setFormData] = useState({
    name: "",
    content_type: "book" as ContentType,
    display_order: 0,
    description: "",
  });

  useEffect(() => {
    loadItems();
  }, [selectedContentType]);

  async function loadItems() {
    setLoading(true);
    try {
      const contentType =
        selectedContentType === "all" ? undefined : selectedContentType;
      const data = await getDifficultyLevelsAction(contentType);
      setItems(data);
    } catch (error) {
      console.error("난이도 조회 실패:", error);
      toast.showError("난이도를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      await createDifficultyLevelAction(
        formData.name,
        formData.content_type,
        formData.display_order
      );
      setFormData({
        name: "",
        content_type: "book",
        display_order: 0,
        description: "",
      });
      setIsCreating(false);
      toast.showSuccess("난이도가 생성되었습니다.");
      loadItems();
    } catch (error) {
      console.error("난이도 생성 실패:", error);
      toast.showError(error instanceof Error ? error.message : "생성에 실패했습니다.");
    }
  }

  async function handleUpdate(id: string) {
    if (!formData.name.trim()) {
      toast.showError("이름을 입력해주세요.");
      return;
    }

    try {
      await updateDifficultyLevelAction(id, {
        name: formData.name,
        display_order: formData.display_order,
        description: formData.description || undefined,
      });
      setEditingId(null);
      setFormData({
        name: "",
        content_type: "book",
        display_order: 0,
        description: "",
      });
      toast.showSuccess("난이도가 수정되었습니다.");
      loadItems();
    } catch (error) {
      console.error("난이도 수정 실패:", error);
      toast.showError(error instanceof Error ? error.message : "수정에 실패했습니다.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deleteDifficultyLevelAction(id);
      toast.showSuccess("난이도가 삭제되었습니다.");
      loadItems();
    } catch (error) {
      console.error("난이도 삭제 실패:", error);
      toast.showError(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  }

  function startEdit(item: DifficultyLevel) {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      content_type: item.content_type,
      display_order: item.display_order ?? 0,
      description: item.description || "",
    });
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: "",
      content_type: "book",
      display_order: 0,
      description: "",
    });
  }

  function getContentTypeLabel(type: ContentType | "common"): string {
    const labels: Record<ContentType | "common", string> = {
      book: "교재",
      lecture: "강의",
      custom: "커스텀",
      common: "공통",
    };
    return labels[type] || type;
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-700">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">난이도 관리</h2>
        <button
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            const maxOrder =
              items.length > 0
                ? Math.max(...items.map((i) => i.display_order ?? 0))
                : 0;
            setFormData({
              name: "",
              content_type: "book",
              display_order: maxOrder + 1,
              description: "",
            });
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          + 추가
        </button>
      </div>

      {/* 콘텐츠 타입 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedContentType("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            selectedContentType === "all"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setSelectedContentType("book")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            selectedContentType === "book"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          교재
        </button>
        <button
          onClick={() => setSelectedContentType("lecture")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            selectedContentType === "lecture"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          강의
        </button>
        <button
          onClick={() => setSelectedContentType("custom")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            selectedContentType === "custom"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          커스텀
        </button>
        <button
          onClick={() => setSelectedContentType("common")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            selectedContentType === "common"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          공통
        </button>
      </div>

      {isCreating && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 개념"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">콘텐츠 타입</label>
              <select
                value={formData.content_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    content_type: e.target.value as ContentType,
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="book">교재</option>
                <option value="lecture">강의</option>
                <option value="custom">커스텀</option>
                <option value="common">공통</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-sm font-medium text-gray-700">정렬 순서</label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
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
          <div className="mt-4 flex flex-col gap-1">
            <label className="block text-sm font-medium text-gray-700">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="난이도에 대한 설명 (선택사항)"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                콘텐츠 타입
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                정렬 순서
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                상태
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-700">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">
                        {getContentTypeLabel(item.content_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={formData.display_order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            display_order: parseInt(e.target.value) || 0,
                          })
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
                            updateDifficultyLevelAction(item.id, {
                              is_active: e.target.checked,
                            }).then(() => loadItems())
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {getContentTypeLabel(item.content_type)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.display_order}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={item.is_active ? "success" : "gray"}
                        size="xs"
                      >
                        {item.is_active ? "활성" : "비활성"}
                      </Badge>
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

