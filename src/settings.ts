import { App, PluginSettingTab, Setting } from "obsidian";
import AstroPublisherPlugin from "./main";
import { AstroPublisherSettings } from "./types";

export const DEFAULT_SETTINGS: AstroPublisherSettings = {
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  defaultContentType: "essay",
  essayRoot: "src/content/essay",
  bitsRoot: "src/content/bits",
  memoPath: "src/content/memo/index.md",
  articleImageRoot: "",
  bitsImageRoot: "public/bits",
  authorImageRoot: "public/author",
  publicImageRoot: "public",
  commitAuthorName: "",
  commitAuthorEmail: ""
};

export class AstroPublisherSettingTab extends PluginSettingTab {
  plugin: AstroPublisherPlugin;

  constructor(app: App, plugin: AstroPublisherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Astro GitHub Publisher" });

    new Setting(containerEl)
      .setName("GitHub owner")
      .setDesc("Repository owner or organization, for example cxro.")
      .addText((text) =>
        text
          .setPlaceholder("owner")
          .setValue(this.plugin.settings.owner)
          .onChange(async (value) => {
            this.plugin.settings.owner = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GitHub repository")
      .setDesc("Repository name, for example astro-whono.")
      .addText((text) =>
        text
          .setPlaceholder("repo")
          .setValue(this.plugin.settings.repo)
          .onChange(async (value) => {
            this.plugin.settings.repo = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Branch")
      .setDesc("The branch Vercel deploys from.")
      .addText((text) =>
        text
          .setPlaceholder("main")
          .setValue(this.plugin.settings.branch)
          .onChange(async (value) => {
            this.plugin.settings.branch = value.trim() || "main";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("GitHub token")
      .setDesc("Fine-grained token with Contents read/write permission for the target repository.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("github_pat_...")
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Default content type")
      .setDesc("Used when the note does not include astroType in frontmatter.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("essay", "Essay")
          .addOption("bits", "Bits")
          .addOption("memo", "Memo")
          .setValue(this.plugin.settings.defaultContentType)
          .onChange(async (value) => {
            this.plugin.settings.defaultContentType = value as AstroPublisherSettings["defaultContentType"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Essay root")
      .setDesc("Astro collection directory for long-form posts.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.essayRoot)
          .onChange(async (value) => {
            this.plugin.settings.essayRoot = cleanPath(value) || DEFAULT_SETTINGS.essayRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Bits root")
      .setDesc("Astro collection directory for short posts.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.bitsRoot)
          .onChange(async (value) => {
            this.plugin.settings.bitsRoot = cleanPath(value) || DEFAULT_SETTINGS.bitsRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Memo path")
      .setDesc("Single Markdown file for memo content.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.memoPath)
          .onChange(async (value) => {
            this.plugin.settings.memoPath = cleanPath(value) || DEFAULT_SETTINGS.memoPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Article image root")
      .setDesc("Optional. Empty means body images are stored next to the Astro Markdown file under src/content. Set to src/assets/essay to centralize them.")
      .addText((text) =>
        text
          .setPlaceholder("src/assets/essay")
          .setValue(this.plugin.settings.articleImageRoot)
          .onChange(async (value) => {
            this.plugin.settings.articleImageRoot = cleanPath(value);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Bits image root")
      .setDesc("Images for bits are public assets. Default: public/bits.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.bitsImageRoot)
          .onChange(async (value) => {
            this.plugin.settings.bitsImageRoot = cleanPath(value) || DEFAULT_SETTINGS.bitsImageRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Author image root")
      .setDesc("Public author/avatar image directory. Default: public/author.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.authorImageRoot)
          .onChange(async (value) => {
            this.plugin.settings.authorImageRoot = cleanPath(value) || DEFAULT_SETTINGS.authorImageRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Public image root")
      .setDesc("Public direct-link image directory. Default: public.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.publicImageRoot)
          .onChange(async (value) => {
            this.plugin.settings.publicImageRoot = cleanPath(value) || DEFAULT_SETTINGS.publicImageRoot;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Commit author name")
      .setDesc("Optional. GitHub uses the token owner when this is empty.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.commitAuthorName)
          .onChange(async (value) => {
            this.plugin.settings.commitAuthorName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Commit author email")
      .setDesc("Optional. Use a GitHub noreply email if you want verified commits.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.commitAuthorEmail)
          .onChange(async (value) => {
            this.plugin.settings.commitAuthorEmail = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}

function cleanPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}
