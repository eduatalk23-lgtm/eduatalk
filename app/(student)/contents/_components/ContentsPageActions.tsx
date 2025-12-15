"use client";

import Link from "next/link";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { inlineButtonBase, inlineButtonPrimary } from "@/lib/utils/darkMode";
import { BookOpen, Headphones, FileText, Plus, ChevronDown } from "lucide-react";

type ContentsPageActionsProps = {
  activeTab: "books" | "lectures" | "custom";
};

export function ContentsPageActions({ activeTab }: ContentsPageActionsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={inlineButtonBase("px-4 py-2 text-sm font-semibold gap-2")}
        >
          <span className="hidden sm:inline">서비스 마스터 콘텐츠</span>
          <span className="sm:hidden">마스터 콘텐츠</span>
          <ChevronDown size={16} aria-hidden="true" className="opacity-70" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item href="/contents/master-books" aria-label="서비스 마스터 교재 페이지로 이동">
            <BookOpen size={16} aria-hidden="true" />
            <span>교재</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item href="/contents/master-lectures" aria-label="서비스 마스터 강의 페이지로 이동">
            <Headphones size={16} aria-hidden="true" />
            <span>강의</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item href="/contents/master-custom-contents" aria-label="서비스 마스터 커스텀 콘텐츠 페이지로 이동">
            <FileText size={16} aria-hidden="true" />
            <span>커스텀 콘텐츠</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {activeTab !== "custom" && (
        <Link
          href={`/contents/${activeTab}/new`}
          className={inlineButtonPrimary("px-4 py-2 text-sm font-semibold gap-2")}
          aria-label={activeTab === "books" ? "새 책 등록" : "새 강의 등록"}
        >
          <Plus size={16} aria-hidden="true" />
          <span>{activeTab === "books" ? "책 등록" : "강의 등록"}</span>
        </Link>
      )}
    </div>
  );
}

