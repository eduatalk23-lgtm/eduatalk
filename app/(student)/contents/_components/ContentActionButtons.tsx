"use client";

import Button from "@/components/atoms/Button";
import { useRouter } from "next/navigation";

export function ContentActionButtons({
  editHref,
  deleteAction,
  listHref
}: {
  editHref?: string;
  deleteAction?: () => Promise<void>;
  listHref?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => router.push(listHref || "/plan")}>
        목록으로
      </Button>
      {editHref && (
        <Button variant="outline" size="sm" onClick={() => router.push(editHref)}>
          수정
        </Button>
      )}
      {deleteAction && (
         <form action={deleteAction}>
           <Button variant="destructive" size="sm" type="submit">
             삭제
           </Button>
         </form>
      )}
    </div>
  );
}