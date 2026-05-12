import { App, normalizePath, TFile } from "obsidian";
import { imageSize } from "image-size";
import { dirname, relativePath } from "./path";
import { toKebabSlug } from "./slug";
import { AstroPublisherSettings, PublishTarget } from "./types";

export interface ImageUpload {
  remotePath: string;
  publicPath: string;
  data: ArrayBuffer;
}

export interface ProcessedImages {
  content: string;
  uploads: ImageUpload[];
}

export interface ThemeImage {
  src: string;
  width?: number;
  height?: number;
}

export interface ProcessedThemeImages {
  content: string;
  uploads: ImageUpload[];
  images: ThemeImage[];
}

interface ImageMatch {
  start: number;
  end: number;
  raw: string;
  link: string;
  alt: string;
  kind: "wiki" | "markdown";
}

export async function processBitsThemeImages(
  app: App,
  sourceFile: TFile,
  content: string,
  slug: string,
  settings: AstroPublisherSettings
): Promise<ProcessedThemeImages> {
  const matches = findImageMatches(content);

  if (matches.length === 0) {
    return { content, uploads: [], images: [] };
  }

  const uploads: ImageUpload[] = [];
  const images: ThemeImage[] = [];
  const removals = new Set<string>();

  for (const image of findDirectThemeImageRefs(content)) {
    images.push({ src: image.src });
    removals.add(image.raw);
  }

  for (const match of matches) {
    const linkedFile = app.metadataCache.getFirstLinkpathDest(decodeLink(match.link), sourceFile.path);
    if (!linkedFile || !isImageFile(linkedFile)) {
      continue;
    }

    const fileName = safeImageFileName(linkedFile);
    const remotePath = normalizePath(`${settings.bitsImageRoot}/${slug}/${fileName}`);
    const publicPath = remotePath.startsWith("public/") ? remotePath.slice("public/".length) : remotePath;
    const data = await app.vault.readBinary(linkedFile);
    const dimensions = readImageDimensions(data);

    uploads.push({ remotePath, publicPath, data });
    images.push({
      src: publicPath,
      width: dimensions.width,
      height: dimensions.height
    });
    removals.add(match.raw);
  }

  if (removals.size === 0) {
    return { content, uploads, images };
  }

  let next = content;
  for (const raw of removals) {
    next = next.split(raw).join("");
  }

  return {
    content: collapseBlankLines(next).trim(),
    uploads,
    images
  };
}

function findDirectThemeImageRefs(content: string): Array<{ raw: string; src: string }> {
  const refs: Array<{ raw: string; src: string }> = [];
  const markdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

  for (const match of content.matchAll(markdownPattern)) {
    const link = stripTitle(match[2].trim());
    if (!isExternalOrPublicPath(link)) {
      continue;
    }

    refs.push({
      raw: match[0],
      src: normalizePublicImageSrc(link)
    });
  }

  return refs;
}

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);

export async function processMarkdownImages(
  app: App,
  sourceFile: TFile,
  content: string,
  target: PublishTarget,
  settings: AstroPublisherSettings
): Promise<ProcessedImages> {
  const matches = findImageMatches(content);

  if (matches.length === 0) {
    return { content, uploads: [] };
  }

  const uploads: ImageUpload[] = [];
  const replacements = new Map<string, string>();

  for (const match of matches) {
    const linkedFile = app.metadataCache.getFirstLinkpathDest(decodeLink(match.link), sourceFile.path);
    if (!linkedFile || !isImageFile(linkedFile)) {
      continue;
    }

    const remotePath = buildRemoteImagePath(linkedFile, target, settings);
    const publicPath = buildPublicImagePath(remotePath, target);
    const data = await app.vault.readBinary(linkedFile);

    uploads.push({ remotePath, publicPath, data });
    replacements.set(match.raw, `![${match.alt || linkedFile.basename}](${publicPath})`);
  }

  if (replacements.size === 0) {
    return { content, uploads };
  }

  let next = content;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }

  return { content: next, uploads };
}

function findImageMatches(content: string): ImageMatch[] {
  const matches: ImageMatch[] = [];
  const wikiPattern = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
  const markdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

  for (const match of content.matchAll(wikiPattern)) {
    if (match.index === undefined) {
      continue;
    }

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      link: match[1].trim(),
      alt: (match[2] ?? "").trim(),
      kind: "wiki"
    });
  }

  for (const match of content.matchAll(markdownPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const link = stripTitle(match[2].trim());
    if (isExternalOrPublicPath(link)) {
      continue;
    }

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      link,
      alt: match[1].trim(),
      kind: "markdown"
    });
  }

  return matches.sort((a, b) => a.start - b.start);
}

function buildRemoteImagePath(file: TFile, target: PublishTarget, settings: AstroPublisherSettings): string {
  const fileName = safeImageFileName(file);

  if (target.contentType === "bits") {
    return normalizePath(`${settings.bitsImageRoot}/${target.slug ?? "bit"}/${fileName}`);
  }

  if (settings.articleImageRoot) {
    return normalizePath(`${settings.articleImageRoot}/${target.slug ?? "post"}/${fileName}`);
  }

  return normalizePath(`${dirname(target.path)}/${target.slug ?? "assets"}/${fileName}`);
}

function buildPublicImagePath(remotePath: string, target: PublishTarget): string {
  if (remotePath.startsWith("public/")) {
    return remotePath.slice("public/".length);
  }

  return relativePath(dirname(target.path), remotePath);
}

function safeImageFileName(file: TFile): string {
  const extension = file.extension.toLowerCase();
  return `${toKebabSlug(file.basename)}.${extension}`;
}

function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

function decodeLink(link: string): string {
  try {
    return decodeURIComponent(link);
  } catch {
    return link;
  }
}

function stripTitle(link: string): string {
  const titleMatch = link.match(/^([^"' ]+)(?:\s+["'][^"']+["'])?$/);
  return titleMatch ? titleMatch[1] : link;
}

function isExternalOrPublicPath(link: string): boolean {
  return /^(?:https?:)?\/\//i.test(link) || link.startsWith("/") || link.startsWith("public/");
}

function normalizePublicImageSrc(link: string): string {
  if (/^(?:https?:)?\/\//i.test(link)) {
    return link;
  }

  return link.replace(/^\/+/, "").replace(/^public\//, "");
}

function readImageDimensions(data: ArrayBuffer): { width?: number; height?: number } {
  try {
    const dimensions = imageSize(new Uint8Array(data));
    return {
      width: dimensions.width,
      height: dimensions.height
    };
  } catch {
    return {};
  }
}

function collapseBlankLines(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n");
}
