'use client';

import { cn } from '@/lib/cn';
import type { ContentType } from '@/lib/domains/admin-plan/types';
import type { AddContentWizardData } from '../types';
import { BookOpen, Video, FileEdit } from 'lucide-react';

interface Step1ContentInfoProps {
  data: AddContentWizardData;
  onChange: (updates: Partial<AddContentWizardData>) => void;
}

const CONTENT_TYPES: { type: ContentType; label: string; icon: React.ReactNode }[] = [
  { type: 'book', label: '교재', icon: <BookOpen className="h-4 w-4" /> },
  { type: 'lecture', label: '강의', icon: <Video className="h-4 w-4" /> },
  { type: 'custom', label: '커스텀', icon: <FileEdit className="h-4 w-4" /> },
];

export function Step1ContentInfo({ data, onChange }: Step1ContentInfoProps) {
  return (
    <div className="space-y-6">
      {/* 콘텐츠 유형 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          콘텐츠 유형
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CONTENT_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ contentType: type })}
              className={cn(
                'flex items-center justify-center gap-2 py-3 px-4 border rounded-lg transition-colors',
                data.contentType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              {icon}
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 과목 정보 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          과목 정보
        </label>
        <div className="grid grid-cols-3 gap-3">
          <select
            value={data.curriculum}
            onChange={(e) => onChange({ curriculum: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">개정과정</option>
            <option value="2022 개정">2022 개정</option>
            <option value="2015 개정">2015 개정</option>
          </select>
          <select
            value={data.subjectArea}
            onChange={(e) => onChange({ subjectArea: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">교과</option>
            <option value="국어">국어</option>
            <option value="수학">수학</option>
            <option value="영어">영어</option>
            <option value="과학">과학</option>
            <option value="사회">사회</option>
          </select>
          <input
            type="text"
            placeholder="과목명"
            value={data.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* 콘텐츠 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          콘텐츠 제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="예: 개념원리 수학1"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* 마스터 콘텐츠 연결 */}
      <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
        <input
          type="checkbox"
          checked={data.linkMaster}
          onChange={(e) => onChange({ linkMaster: e.target.checked })}
          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-700">마스터 콘텐츠 연결</div>
          <div className="text-xs text-gray-500">기존 콘텐츠 데이터베이스와 연결합니다 (선택)</div>
        </div>
      </label>
    </div>
  );
}
