export type AstroContentType = "essay" | "bits" | "memo";

export interface AstroPublisherSettings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  defaultContentType: AstroContentType;
  essayRoot: string;
  bitsRoot: string;
  memoPath: string;
  articleImageRoot: string;
  bitsImageRoot: string;
  authorImageRoot: string;
  publicImageRoot: string;
  commitAuthorName: string;
  commitAuthorEmail: string;
}

export interface PublishFrontmatter {
  astroType?: AstroContentType;
  title?: string;
  slug?: string;
  astroPath?: string;
  date?: string | Date;
  draft?: boolean;
  tags?: string[];
}

export interface PublishTarget {
  contentType: AstroContentType;
  path: string;
  slug?: string;
  message: string;
}

export interface GitHubFile {
  sha: string;
  content: string;
}
