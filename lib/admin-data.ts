import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { list, get } from "@vercel/blob";

const PUBLIC_DIRS = [
  path.join(process.cwd(), "context", "prompt"),
  path.join(process.cwd(), "context", "deeper-context"),
];
const BLOB_PREFIX = "_prep";

function isMarkdown(f: string): boolean {
  return f.endsWith(".md");
}

function isReadme(f: string): boolean {
  return /^README/i.test(f);
}

/** Rough token estimate. Real tokenization is model-specific; this is order-of-magnitude. */
function estimateTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

export type SectionFile = {
  path: string; // pretty path for display
  size: number; // bytes
  tokens: number; // estimate
};

export type SourceGroup = {
  name: string; // human-readable label, e.g., "context/prompt/"
  files: SectionFile[];
  totalBytes: number;
  totalTokens: number;
};

export type Inventory = {
  sources: SourceGroup[];
  totalBytes: number;
  totalTokens: number;
};

export type PromptSection = {
  source: string; // group label
  path: string;
  size: number;
  tokens: number;
  content: string;
};

async function walkLocalDir(dir: string): Promise<{ relPath: string; absPath: string; size: number }[]> {
  let dirents: import("node:fs").Dirent[];
  try {
    dirents = await fs.readdir(dir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  const out: { relPath: string; absPath: string; size: number }[] = [];
  for (const d of dirents) {
    if (!d.isFile() || !isMarkdown(d.name) || isReadme(d.name)) continue;
    const absPath = path.join(d.parentPath, d.name);
    const stat = await fs.stat(absPath);
    out.push({
      relPath: path.relative(dir, absPath),
      absPath,
      size: stat.size,
    });
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

export async function collectInventory(): Promise<Inventory> {
  const sources: SourceGroup[] = [];

  for (const dir of PUBLIC_DIRS) {
    const entries = await walkLocalDir(dir);
    const files: SectionFile[] = entries.map((e) => ({
      path: e.relPath,
      size: e.size,
      tokens: estimateTokens(e.size),
    }));
    sources.push({
      name: path.relative(process.cwd(), dir).replace(/\\/g, "/") + "/",
      files,
      totalBytes: files.reduce((s, f) => s + f.size, 0),
      totalTokens: files.reduce((s, f) => s + f.tokens, 0),
    });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const result = await list({ prefix: `${BLOB_PREFIX}/` });
      const blobs = result.blobs
        .filter((b) => isMarkdown(b.pathname))
        .filter((b) => !isReadme(path.basename(b.pathname)))
        .sort((a, b) => a.pathname.localeCompare(b.pathname));
      const files: SectionFile[] = blobs.map((b) => ({
        path: b.pathname,
        size: b.size,
        tokens: estimateTokens(b.size),
      }));
      sources.push({
        name: "Vercel Blob (private)",
        files,
        totalBytes: files.reduce((s, f) => s + f.size, 0),
        totalTokens: files.reduce((s, f) => s + f.tokens, 0),
      });
    } catch (err) {
      // surface as an empty source rather than crash the page
      console.error("[admin] blob list failed", err);
      sources.push({
        name: "Vercel Blob (unavailable)",
        files: [],
        totalBytes: 0,
        totalTokens: 0,
      });
    }
  }

  return {
    sources,
    totalBytes: sources.reduce((s, g) => s + g.totalBytes, 0),
    totalTokens: sources.reduce((s, g) => s + g.totalTokens, 0),
  };
}

export async function collectPromptSections(): Promise<PromptSection[]> {
  const sections: PromptSection[] = [];

  for (const dir of PUBLIC_DIRS) {
    const sourceLabel =
      path.relative(process.cwd(), dir).replace(/\\/g, "/") + "/";
    const entries = await walkLocalDir(dir);
    for (const e of entries) {
      const content = (await fs.readFile(e.absPath, "utf-8")).trim();
      sections.push({
        source: sourceLabel,
        path: e.relPath,
        size: e.size,
        tokens: estimateTokens(e.size),
        content,
      });
    }
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const result = await list({ prefix: `${BLOB_PREFIX}/` });
      const blobs = result.blobs
        .filter((b) => isMarkdown(b.pathname))
        .filter((b) => !isReadme(path.basename(b.pathname)))
        .sort((a, b) => a.pathname.localeCompare(b.pathname));
      for (const b of blobs) {
        const r = await get(b.pathname, { access: "private" });
        if (!r) continue;
        const content = (await new Response(r.stream).text()).trim();
        sections.push({
          source: "Vercel Blob (private)",
          path: b.pathname,
          size: b.size,
          tokens: estimateTokens(b.size),
          content,
        });
      }
    } catch (err) {
      console.error("[admin] blob fetch failed", err);
    }
  }

  return sections;
}
