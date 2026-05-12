import { parseYaml } from "obsidian";
import { PublishFrontmatter } from "./types";

export interface ParsedMarkdown {
  frontmatter: PublishFrontmatter;
  body: string;
  rawFrontmatter: string;
}

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export function parseMarkdown(source: string): ParsedMarkdown {
  const match = source.match(FRONTMATTER_PATTERN);

  if (!match) {
    return {
      frontmatter: {},
      body: source,
      rawFrontmatter: ""
    };
  }

  const rawFrontmatter = match[1];
  const parsed = parseYaml(rawFrontmatter) ?? {};

  return {
    frontmatter: normalizeFrontmatter(parsed),
    body: source.slice(match[0].length),
    rawFrontmatter
  };
}

export function stringifyMarkdown(parsed: ParsedMarkdown, fields: Record<string, string> = {}): string {
  const rawFrontmatter = upsertFrontmatterFields(parsed.rawFrontmatter, fields);

  if (!rawFrontmatter) {
    return parsed.body;
  }

  return `---\n${rawFrontmatter.trim()}\n---\n${parsed.body.startsWith("\n") ? "" : "\n"}${parsed.body}`;
}

function normalizeFrontmatter(value: Record<string, unknown>): PublishFrontmatter {
  const frontmatter: PublishFrontmatter = {};

  if (value.astroType === "essay" || value.astroType === "bits" || value.astroType === "memo") {
    frontmatter.astroType = value.astroType;
  }

  if (typeof value.title === "string") {
    frontmatter.title = value.title;
  }

  if (typeof value.slug === "string") {
    frontmatter.slug = value.slug;
  }

  if (typeof value.astroPath === "string") {
    frontmatter.astroPath = value.astroPath;
  }

  if (typeof value.date === "string" || value.date instanceof Date) {
    frontmatter.date = value.date;
  }

  if (typeof value.draft === "boolean") {
    frontmatter.draft = value.draft;
  }

  if (Array.isArray(value.tags)) {
    frontmatter.tags = value.tags.filter((tag): tag is string => typeof tag === "string");
  }

  return frontmatter;
}

function upsertFrontmatterFields(rawFrontmatter: string, fields: Record<string, string>): string {
  let next = rawFrontmatter.trim();

  for (const [key, value] of Object.entries(fields)) {
    const line = `${key}: ${JSON.stringify(value)}`;
    const fieldPattern = new RegExp(`^${escapeRegExp(key)}\\s*:.*$`, "m");

    if (fieldPattern.test(next)) {
      next = next.replace(fieldPattern, line);
    } else {
      next = next ? `${next}\n${line}` : line;
    }
  }

  return next;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
