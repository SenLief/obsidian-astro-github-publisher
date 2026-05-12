import { requestUrl } from "obsidian";
import { AstroPublisherSettings } from "./types";

interface GitHubContentResponse {
  sha?: string;
  content?: string;
  encoding?: string;
}

interface PutFileOptions {
  settings: AstroPublisherSettings;
  path: string;
  content: string;
  message: string;
}

interface PutBinaryFileOptions {
  settings: AstroPublisherSettings;
  path: string;
  data: ArrayBuffer;
  message: string;
}

const API_ROOT = "https://api.github.com";

export class GitHubClient {
  async putFile(options: PutFileOptions): Promise<void> {
    await this.putFileBase64({
      settings: options.settings,
      path: options.path,
      contentBase64: encodeBase64(options.content),
      message: options.message
    });
  }

  async putBinaryFile(options: PutBinaryFileOptions): Promise<void> {
    await this.putFileBase64({
      settings: options.settings,
      path: options.path,
      contentBase64: encodeArrayBufferBase64(options.data),
      message: options.message
    });
  }

  private async putFileBase64(options: {
    settings: AstroPublisherSettings;
    path: string;
    contentBase64: string;
    message: string;
  }): Promise<void> {
    const existing = await this.getFile(options.settings, options.path);
    const body: Record<string, unknown> = {
      message: options.message,
      content: options.contentBase64,
      branch: options.settings.branch
    };

    if (existing?.sha) {
      body.sha = existing.sha;
    }

    const author = buildAuthor(options.settings);
    if (author) {
      body.author = author;
      body.committer = author;
    }

    const response = await requestUrl({
      url: this.contentUrl(options.settings, options.path),
      method: "PUT",
      headers: this.headers(options.settings),
      body: JSON.stringify(body),
      throw: false
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(readGitHubError(response.status, response.text));
    }
  }

  async deleteFile(settings: AstroPublisherSettings, path: string, message: string): Promise<void> {
    const existing = await this.getFile(settings, path);

    if (!existing?.sha) {
      throw new Error(`Remote file not found: ${path}`);
    }

    const body: Record<string, unknown> = {
      message,
      sha: existing.sha,
      branch: settings.branch
    };

    const author = buildAuthor(settings);
    if (author) {
      body.author = author;
      body.committer = author;
    }

    const response = await requestUrl({
      url: this.contentUrl(settings, path),
      method: "DELETE",
      headers: this.headers(settings),
      body: JSON.stringify(body),
      throw: false
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(readGitHubError(response.status, response.text));
    }
  }

  private async getFile(settings: AstroPublisherSettings, path: string): Promise<GitHubContentResponse | null> {
    const response = await requestUrl({
      url: `${this.contentUrl(settings, path)}?ref=${encodeURIComponent(settings.branch)}`,
      method: "GET",
      headers: this.headers(settings),
      throw: false
    });

    if (response.status === 404) {
      return null;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(readGitHubError(response.status, response.text));
    }

    return response.json as GitHubContentResponse;
  }

  private contentUrl(settings: AstroPublisherSettings, path: string): string {
    return `${API_ROOT}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  private headers(settings: AstroPublisherSettings): Record<string, string> {
    return {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }
}

function buildAuthor(settings: AstroPublisherSettings): { name: string; email: string } | null {
  if (!settings.commitAuthorName || !settings.commitAuthorEmail) {
    return null;
  }

  return {
    name: settings.commitAuthorName,
    email: settings.commitAuthorEmail
  };
}

function encodeBase64(value: string): string {
  return window.btoa(unescape(encodeURIComponent(value)));
}

function encodeArrayBufferBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

function readGitHubError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return `GitHub request failed (${status}): ${parsed.message ?? text}`;
  } catch {
    return `GitHub request failed (${status}): ${text}`;
  }
}
