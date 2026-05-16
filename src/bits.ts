import { App, TFile } from "obsidian";
import { processBitsThemeImages, ThemeImage } from "./images";
import { AstroPublisherSettings } from "./types";

export interface BitsPublishItem {
  content: string;
  path: string;
  date: string;
  tags: string[];
  images: ThemeImage[];
  uploads: Array<{
    remotePath: string;
    data: ArrayBuffer;
  }>;
  startLine: number;
  endLine: number;
  replacement: string;
}

interface BitsBlock {
  startLine: number;
  endLine: number;
  lines: string[];
  meta: Record<string, string>;
}

export async function buildBitsPublishItems(
  app: App,
  file: TFile,
  source: string,
  settings: AstroPublisherSettings
): Promise<BitsPublishItem[]> {
  const blocks = parseBitsBlocks(source);
  const usedPaths = new Set<string>();
  const items: BitsPublishItem[] = [];

  for (const [index, block] of blocks.entries()) {
    const rawContent = stripMetaComments(block.lines.join("\n")).trim();
    if (!rawContent) {
      continue;
    }

    const tags = extractTags(rawContent);
    const contentWithoutTags = stripStandaloneTagLines(rawContent);
    const date = block.meta.publishedAt ?? buildLocalDateTime(file, index);
    const path = block.meta.astroPath ?? buildBitsPath(settings, date, usedPaths);
    usedPaths.add(path);
    const processed = await processBitsThemeImages(app, file, contentWithoutTags, fileSlug(path), settings);
    const markdown = stringifyBitsMarkdown({
      date,
      tags,
      images: processed.images,
      body: processed.content
    });

    items.push({
      content: markdown,
      path,
      date,
      tags,
      images: processed.images,
      uploads: processed.uploads.map((upload) => ({
        remotePath: upload.remotePath,
        data: upload.data
      })),
      startLine: block.startLine,
      endLine: block.endLine,
      replacement: stringifyBitsCallout(block.lines, {
        astroPath: path,
        publishedAt: date
      })
    });
  }

  return items;
}

export function applyBitsReplacements(source: string, items: BitsPublishItem[]): string {
  if (items.length === 0) {
    return source;
  }

  const lines = source.split("\n");
  const sorted = [...items].sort((a, b) => b.startLine - a.startLine);

  for (const item of sorted) {
    lines.splice(item.startLine, item.endLine - item.startLine + 1, ...item.replacement.split("\n"));
  }

  return lines.join("\n");
}

function parseBitsBlocks(source: string): BitsBlock[] {
  const lines = source.split("\n");
  const blocks: BitsBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!/^>\s*\[!astro-bits\]\s*$/i.test(lines[index])) {
      index += 1;
      continue;
    }

    const startLine = index;
    const blockLines: string[] = [];
    index += 1;

    while (index < lines.length && /^>\s?/.test(lines[index])) {
      blockLines.push(lines[index].replace(/^>\s?/, ""));
      index += 1;
    }

    blocks.push({
      startLine,
      endLine: index - 1,
      lines: blockLines,
      meta: readMetaComments(blockLines)
    });
  }

  return blocks;
}

function readMetaComments(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^<!--\s*(astroPath|slug|publishedAt):\s*(.*?)\s*-->$/);
    if (match) {
      meta[match[1]] = match[2];
    }
  }

  return meta;
}

function stripMetaComments(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^<!--\s*(astroPath|slug|publishedAt):/.test(line.trim()))
    .join("\n");
}

function stringifyBitsCallout(lines: string[], meta: Record<string, string>): string {
  const contentLines = stripMetaComments(lines.join("\n")).replace(/^\n+/, "").split("\n");
  const metaLines = [
    `<!-- astroPath: ${meta.astroPath} -->`,
    `<!-- publishedAt: ${meta.publishedAt} -->`,
    ""
  ];

  return ["> [!astro-bits]", ...metaLines, ...contentLines].map((line) => `> ${line}`.trimEnd()).join("\n");
}

function stringifyBitsMarkdown(options: {
  date: string;
  tags: string[];
  images: ThemeImage[];
  body: string;
}): string {
  const frontmatter = ["---", `date: ${options.date}`];

  if (options.tags.length > 0) {
    frontmatter.push("tags:");
    for (const tag of options.tags) {
      frontmatter.push(`  - ${quoteYaml(tag)}`);
    }
  }

  if (options.images.length > 0) {
    frontmatter.push("images:");
    for (const image of options.images) {
      frontmatter.push(`  - src: ${quoteYaml(image.src)}`);
      if (image.width) {
        frontmatter.push(`    width: ${image.width}`);
      }
      if (image.height) {
        frontmatter.push(`    height: ${image.height}`);
      }
    }
  }

  frontmatter.push("---", "");
  return `${frontmatter.join("\n")}${options.body.trim()}\n`;
}

function buildBitsPath(
  settings: AstroPublisherSettings,
  date: string,
  usedPaths: Set<string>
): string {
  const stamp = date.slice(0, 16).replace("T", "-").replace(":", "");
  let path = `${settings.bitsRoot}/bits-${stamp}.md`;
  let suffix = 2;

  while (usedPaths.has(path)) {
    path = `${settings.bitsRoot}/bits-${stamp}-${suffix}.md`;
    suffix += 1;
  }

  return path;
}

function fileSlug(path: string): string {
  const fileName = path.split("/").pop() ?? "bit";
  return fileName.replace(/\.md$/i, "") || "bit";
}

function buildLocalDateTime(file: TFile, index: number): string {
  const day = file.basename.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const now = new Date();
  const date = day ? new Date(`${day}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`) : now;
  date.setMinutes(date.getMinutes() + index);
  return formatLocalDateTime(date);
}

function formatLocalDateTime(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    "T",
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
  ].join("");
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function extractTags(value: string): string[] {
  const tags = new Set<string>();
  const pattern = /(^|\s)#([^\s#]+)/g;

  for (const match of value.matchAll(pattern)) {
    tags.add(match[2].replace(/^loc\//, "loc:"));
  }

  return [...tags];
}

function stripStandaloneTagLines(value: string): string {
  return value
    .split("\n")
    .filter((line) => !/^\s*(#[^\s#]+\s*)+$/.test(line))
    .join("\n")
    .trim();
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}
