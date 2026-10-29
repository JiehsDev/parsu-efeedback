// Category classification is presentation metadata, never complaint ownership.
export const CATEGORY_GROUPS = ["osas", "vpaa", "vpaf"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];
export const CATEGORY_GROUP_OPTIONS = [
  { value: "osas", label: "OSAS" },
  { value: "vpaa", label: "VPAA" },
  { value: "vpaf", label: "VPAF" },
  { value: null, label: "Other categories" },
] as const;
export function categoryGroupLabel(group?: CategoryGroup | null) {
  return (
    CATEGORY_GROUP_OPTIONS.find((option) => option.value === (group ?? null))?.label ??
    "Other categories"
  );
}
