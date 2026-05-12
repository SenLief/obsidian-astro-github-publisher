import { pinyin } from "pinyin-pro";

export function toKebabSlug(value: string): string {
  const romanized = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive"
  }).join(" ");

  const slug = romanized
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `post-${hashSlug(value)}`;
}

function hashSlug(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}
