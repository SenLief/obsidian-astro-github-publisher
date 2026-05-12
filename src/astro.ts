import { normalizePath, TFile } from "obsidian";
import { ParsedMarkdown } from "./frontmatter";
import { toKebabSlug } from "./slug";
import { AstroContentType, AstroPublisherSettings, PublishTarget } from "./types";

export function buildPublishTarget(
  file: TFile,
  markdown: ParsedMarkdown,
  settings: AstroPublisherSettings
): PublishTarget {
  const contentType = markdown.frontmatter.astroType ?? settings.defaultContentType;
  const date = normalizeDate(markdown.frontmatter.date);
  const slug = markdown.frontmatter.slug ? toKebabSlug(markdown.frontmatter.slug) : toKebabSlug(file.basename);
  const title = markdown.frontmatter.title ?? file.basename;

  if (contentType === "memo") {
    return {
      contentType,
      path: normalizePath(markdown.frontmatter.astroPath ?? settings.memoPath),
      message: `Publish memo: ${title}`
    };
  }

  if (contentType === "bits") {
    const timestamp = formatTimestamp(date);
    return {
      contentType,
      path: normalizePath(markdown.frontmatter.astroPath ?? `${settings.bitsRoot}/bits-${timestamp}.md`),
      slug,
      message: `Publish bit: ${title}`
    };
  }

  return {
    contentType,
    path: normalizePath(markdown.frontmatter.astroPath ?? `${settings.essayRoot}/${date.getFullYear()}/${slug}.md`),
    slug,
    message: `Publish essay: ${title}`
  };
}

export function validateContentType(value: string | undefined): AstroContentType | null {
  if (value === "essay" || value === "bits" || value === "memo") {
    return value;
  }

  return null;
}

function normalizeDate(value: string | Date | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}-${hour}${minute}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
