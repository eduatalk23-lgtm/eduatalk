"use client";

import { FormSelect } from "@/components/molecules/FormField";
import type { Publisher } from "@/lib/data/contentMetadata";

type PublisherSelectFieldProps = {
  publishers: Publisher[];
  defaultValue?: string;
  defaultPublisherName?: string;
};

export function PublisherSelectField({
  publishers,
  defaultValue = "",
  defaultPublisherName = "",
}: PublisherSelectFieldProps) {
  return (
    <>
      <FormSelect
        label="출판사"
        name="publisher_id"
        defaultValue={defaultValue}
        options={[
          { value: "", label: "선택하세요" },
          ...publishers.map((publisher) => ({
            value: publisher.id,
            label: publisher.name,
          })),
        ]}
        onChange={(e) => {
          const selectedPublisher = publishers.find(p => p.id === e.target.value);
          const publisherNameInput = document.querySelector('input[name="publisher_name"]') as HTMLInputElement;
          if (publisherNameInput && selectedPublisher) {
            publisherNameInput.value = selectedPublisher.name;
          }
        }}
      />
      <input
        type="hidden"
        name="publisher_name"
        defaultValue={defaultPublisherName}
      />
    </>
  );
}

