import { Editor, MarkdownView, Modal, Notice, Plugin, Setting, TFile } from "obsidian";
import { buildPublishTarget, validateContentType } from "./astro";
import { applyBitsReplacements, buildBitsPublishItems } from "./bits";
import { parseMarkdown, stringifyMarkdown } from "./frontmatter";
import { GitHubClient } from "./github";
import { processMarkdownImages } from "./images";
import { AstroPublisherSettingTab, DEFAULT_SETTINGS } from "./settings";
import { toKebabSlug } from "./slug";
import { AstroPublisherSettings } from "./types";

export default class AstroPublisherPlugin extends Plugin {
  settings: AstroPublisherSettings;
  private github: GitHubClient;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.github = new GitHubClient();

    this.addSettingTab(new AstroPublisherSettingTab(this.app, this));

    this.addCommand({
      id: "publish-current-note",
      name: "Publish current note to Astro",
      editorCallback: async (_editor: Editor, view: MarkdownView) => {
        await this.publishFile(view.file);
      }
    });

    this.addCommand({
      id: "insert-astro-frontmatter",
      name: "Insert Astro frontmatter",
      editorCallback: (editor: Editor) => {
        this.insertFrontmatter(editor);
      }
    });

    this.addCommand({
      id: "insert-astro-bits-callout",
      name: "Insert Astro bits callout",
      editorCallback: (editor: Editor) => {
        this.insertBitsCallout(editor);
      }
    });

    this.addCommand({
      id: "publish-bits-from-current-note",
      name: "Publish bits from current note",
      callback: async () => {
        await this.publishBitsFromCurrentNote();
      }
    });

    this.addCommand({
      id: "delete-remote-file-by-path",
      name: "Delete Astro file from GitHub by path",
      callback: () => {
        new DeleteRemoteFileModal(this, async (path) => {
          await this.deleteRemoteFile(path);
        }).open();
      }
    });

    this.addRibbonIcon("upload-cloud", "Publish current note to Astro", async () => {
      const file = this.app.workspace.getActiveFile();
      await this.publishFile(file);
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async publishFile(file: TFile | null): Promise<void> {
    try {
      if (!file || file.extension !== "md") {
        new Notice("Open a Markdown note before publishing.");
        return;
      }

      this.validateSettings();

      const source = await this.app.vault.read(file);
      const markdown = parseMarkdown(source);
      const target = buildPublishTarget(file, markdown, this.settings);
      const publishFields = buildPublishFields(target);
      const content = stringifyMarkdown(markdown, publishFields);
      const processed = await processMarkdownImages(this.app, file, content, target, this.settings);

      for (const upload of processed.uploads) {
        await this.github.putBinaryFile({
          settings: this.settings,
          path: upload.remotePath,
          data: upload.data,
          message: `Upload image: ${upload.remotePath}`
        });
      }

      await this.github.putFile({
        settings: this.settings,
        path: target.path,
        content: processed.content,
        message: target.message
      });

      if (source !== content) {
        await this.app.vault.modify(file, content);
      }

      const imageCount = processed.uploads.length;
      new Notice(`Published to ${target.path}${imageCount > 0 ? ` with ${imageCount} image(s)` : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      new Notice(`Astro publish failed: ${message}`, 8000);
    }
  }

  private insertFrontmatter(editor: Editor): void {
    const contentType = validateContentType(this.settings.defaultContentType) ?? "essay";
    const title = this.app.workspace.getActiveFile()?.basename ?? "Untitled";
    const today = new Date().toISOString().slice(0, 10);

    const frontmatter = [
      "---",
      `astroType: ${contentType}`,
      `title: ${quoteYaml(title)}`,
      `date: ${today}`,
      `slug: ${quoteYaml(toKebabSlug(title))}`,
      "draft: false",
      "tags: []",
      "---",
      ""
    ].join("\n");

    editor.replaceRange(frontmatter, { line: 0, ch: 0 });
  }

  private insertBitsCallout(editor: Editor): void {
    const cursor = editor.getCursor();
    const callout = ["> [!astro-bits]", "> ", "> "].join("\n");
    editor.replaceRange(callout, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 2 });
  }

  private async publishBitsFromCurrentNote(): Promise<void> {
    try {
      const file = this.app.workspace.getActiveFile();
      if (!file || file.extension !== "md") {
        new Notice("Open a Markdown note before publishing bits.");
        return;
      }

      this.validateSettings();

      const source = await this.app.vault.read(file);
      const items = await buildBitsPublishItems(this.app, file, source, this.settings);

      if (items.length === 0) {
        new Notice("No astro-bits callouts found.");
        return;
      }

      for (const item of items) {
        for (const upload of item.uploads) {
          await this.github.putBinaryFile({
            settings: this.settings,
            path: upload.remotePath,
            data: upload.data,
            message: `Upload bits image: ${upload.remotePath}`
          });
        }

        await this.github.putFile({
          settings: this.settings,
          path: item.path,
          content: item.content,
          message: `Publish bit: ${item.path}`
        });
      }

      const updatedSource = applyBitsReplacements(source, items);
      if (updatedSource !== source) {
        await this.app.vault.modify(file, updatedSource);
      }

      new Notice(`Published ${items.length} bit(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      new Notice(`Bits publish failed: ${message}`, 8000);
    }
  }

  private async deleteRemoteFile(path: string): Promise<void> {
    try {
      this.validateSettings();

      const cleanPath = path.trim().replace(/^\/+/, "");
      if (!cleanPath) {
        new Notice("Enter a GitHub file path to delete.");
        return;
      }

      await this.github.deleteFile(this.settings, cleanPath, `Delete Astro file: ${cleanPath}`);
      new Notice(`Deleted ${cleanPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      new Notice(`Astro delete failed: ${message}`, 8000);
    }
  }

  private validateSettings(): void {
    const missing: string[] = [];

    if (!this.settings.owner) {
      missing.push("GitHub owner");
    }

    if (!this.settings.repo) {
      missing.push("GitHub repository");
    }

    if (!this.settings.branch) {
      missing.push("branch");
    }

    if (!this.settings.token) {
      missing.push("GitHub token");
    }

    if (missing.length > 0) {
      throw new Error(`Missing settings: ${missing.join(", ")}`);
    }
  }
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function buildPublishFields(target: ReturnType<typeof buildPublishTarget>): Record<string, string> {
  const fields: Record<string, string> = {
    astroPath: target.path
  };

  if (target.slug) {
    fields.slug = target.slug;
  }

  return fields;
}

class DeleteRemoteFileModal extends Modal {
  private path = "";
  private readonly plugin: AstroPublisherPlugin;
  private readonly onSubmit: (path: string) => Promise<void>;

  constructor(plugin: AstroPublisherPlugin, onSubmit: (path: string) => Promise<void>) {
    super(plugin.app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Delete Astro file from GitHub" });

    new Setting(contentEl)
      .setName("Remote path")
      .setDesc("For example src/content/essay/2026/test.md")
      .addText((text) => {
        text
          .setPlaceholder("src/content/essay/2026/test.md")
          .onChange((value) => {
            this.path = value;
          });
      });

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("Delete")
        .setWarning()
        .onClick(async () => {
          this.close();
          await this.onSubmit(this.path);
        });
    });

    contentEl.createDiv({
      cls: "astro-publisher-status",
      text: `Repository: ${this.plugin.settings.owner || "owner"}/${this.plugin.settings.repo || "repo"}`
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
