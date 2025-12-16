"use client";

import {
  getPublishersAction,
  createPublisherAction,
  updatePublisherAction,
  deletePublisherAction,
} from "@/app/(admin)/actions/contentMetadataActions";
import type { Publisher } from "@/lib/data/contentMetadata";
import { BaseMetadataManager } from "./BaseMetadataManager";

export function PublishersManager() {
  return (
    <BaseMetadataManager<Publisher>
      title="출판사 관리"
      fetchAction={getPublishersAction}
      createAction={createPublisherAction}
      updateAction={updatePublisherAction}
      deleteAction={deletePublisherAction}
      namePlaceholder="예: 비상교육"
    />
  );
}

