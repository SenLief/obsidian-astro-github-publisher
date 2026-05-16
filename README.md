# Astro GitHub Publisher

Manage Astro blog content from Obsidian and publish Markdown files directly to a GitHub repository.

This plugin is designed around Astro content collections and works well with themes like `cxro/astro-whono`, where content lives under paths such as:

- `src/content/essay`
- `src/content/bits`
- `src/content/memo/index.md`

## Current Features

- Publish the current Obsidian Markdown note to GitHub.
- Create or update the matching file in the configured branch.
- Generate Astro paths for `essay`, `bits`, and `memo` content.
- Convert Chinese titles and file names to pinyin slugs, then force lowercase ASCII kebab-case.
- Upload local Obsidian image attachments and rewrite image links for Astro.
- Publish `astro-bits` callouts from daily notes as titleless bits entries.
- Convert bits images into the theme's frontmatter `images` format with width and height.
- Re-publish an already published note to update the same GitHub file.
- Delete an existing remote Astro file by GitHub path.
- Insert starter Astro frontmatter.
- Configure repository owner, repo, branch, content roots, and optional commit author.

## Frontmatter

```yaml
---
astroType: essay
title: My Post
date: 2026-05-12
draft: false
slug: my-post
tags:
  - Astro
  - Obsidian
---
```

`astroType` can be:

- `essay`: publishes to `src/content/essay/YYYY/slug.md`
- `bits`: publishes to `src/content/bits/bits-YYYY-MM-DD-HHmm.md`
- `memo`: publishes to `src/content/memo/index.md`

When `slug` is missing, the plugin uses the Obsidian file name. Chinese file names are converted to pinyin. For example, `测试.md` becomes `ceshi`.

For Astro themes that require strict public slugs, the generated slug is always lowercase ASCII kebab-case. The plugin also writes the generated slug into the Markdown uploaded to GitHub.

After a successful publish, the plugin also writes `astroPath` into your local note:

```yaml
astroPath: "src/content/essay/2026/ceshi.md"
```

This records the remote GitHub file path. If you later fix typos or edit the article in Obsidian, run `Publish current note to Astro` again and the plugin updates that same GitHub file.

If you intentionally want to publish the note as a new post, remove `astroPath` or change `slug`, then publish again.

## Fixing Invalid Slug Deploy Errors

If Vercel fails with `Invalid public essay slug detected`, remove the already-published invalid file or give it a valid `frontmatter.slug`.

For example, delete this remote file if it exists:

```text
src/content/essay/2026/测试.md
```

Use the command `Delete Astro file from GitHub by path`, then publish the note again.

## Bits From Daily Notes

For short posts, write normal Obsidian callouts inside a daily note:

```md
> [!astro-bits]
> 今天在深圳读到一段很好的文字。
>
> ![[阅读现场.webp]]
>
> #loc/深圳 #阅读
```

Run `Publish bits from current note`. The plugin publishes each `astro-bits` callout as a separate file under `src/content/bits`.

After publishing, the callout gets hidden metadata so re-running the command updates the same GitHub file:

```md
> [!astro-bits]
> <!-- astroPath: src/content/bits/bits-2026-05-12-1200.md -->
> <!-- publishedAt: 2026-05-12T12:00:00+08:00 -->
>
> 今天在深圳读到一段很好的文字。
>
> ![[阅读现场.webp]]
>
> #loc/深圳 #阅读
```

The generated bits Markdown is titleless and uses the theme image format:

```yaml
---
date: 2026-05-12T12:00:00+08:00
tags:
  - "loc:深圳"
  - "阅读"
images:
  - src: "bits/bits-2026-05-12-1200/yue-du-xian-chang.webp"
    width: 800
    height: 800
---
```

The image line is removed from the published body because the theme renders it from `images`.

Use `#loc/深圳` in Obsidian; the plugin publishes it as `loc:深圳`.

## Images

Keep using Obsidian's default local image syntax while writing:

```md
![[测试图片.png]]
![Alt text](attachments/demo.jpg)
```

When publishing normal notes, the plugin uploads local image attachments to GitHub and rewrites only the uploaded Markdown content. Your local Obsidian note is not changed.

Default behavior:

- `essay` and `memo` body images are stored next to the Astro Markdown file under `src/content`.
- `bits` callout images are stored under `public/bits` and written to frontmatter `images`.
- Existing `https://...`, `/...`, and `public/...` image paths are left unchanged.

Examples:

```text
测试文章.md
src/content/essay/2026/ceshi.md
src/content/essay/2026/ceshi/tu-pian.png
```

The Markdown uploaded to GitHub uses:

```md
![测试图片](./ceshi/tu-pian.png)
```

For bits:

```text
public/bits/ceshi/tu-pian.png
```

The Markdown uploaded to GitHub uses:

```md
![测试图片](bits/ceshi/tu-pian.png)
```

If you prefer article images under `src/assets`, set `Article image root` to something like:

```text
src/assets/essay
```

The plugin will still write relative Markdown paths so Astro can process those assets during build.

Theme asset guidance:

- Article body images: use `src/content/**` by default, or set `Article image root` to `src/assets/**`.
- `/bits/` images: use `public/bits/**`.
- `/bits/` default avatar: use `public/author/**`.
- Home Hero: can use `src/assets/**`, `public/**`, or `https://...`.
- Images that need public direct links or should skip Astro processing: use `public/**`.

## GitHub Token

Create a fine-grained GitHub token with access to the target repository and this permission:

- Contents: Read and write

Paste the token into the plugin settings. Vercel will deploy automatically if the Astro project is already connected to that GitHub branch.

## Development

```bash
npm install
npm run build
```

For local testing, copy or symlink these files into an Obsidian vault plugin folder:

```text
.obsidian/plugins/astro-github-publisher/
  main.js
  manifest.json
  styles.css
```
