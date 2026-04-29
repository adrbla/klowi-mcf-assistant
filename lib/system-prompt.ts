import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { list, get } from "@vercel/blob";

/**
 * Assembles the coach system prompt from two sources:
 *  1. context/prompt/**.md   — public, committed scaffold (coach behavior, formats, factual COS).
 *  2. private corpus         — strategy, drafts, intimate notes. Resolved via:
 *       - MCF_PREP_DIR env var → local filesystem (preferred for dev)
 *       - else BLOB_READ_WRITE_TOKEN → Vercel Blob (production)
 *       - else empty
 *
 * Subdirectories are walked recursively and concatenated in path-sorted order.
 * The result is fed to Anthropic with prompt caching breakpoints.
 *
 * The Blob path is hidden from Turbopack via env-only path resolution: there's no
 * literal symlink path string in source (the Drive symlink would otherwise crash
 * static asset tracing).
 */

const PUBLIC_PROMPT_DIRS = [
  path.join(process.cwd(), "context", "prompt"),
  path.join(process.cwd(), "context", "deeper-context"),
];
const BLOB_PREFIX = "_prep";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { content: string; expiresAt: number };
let blobCache: CacheEntry | null = null;

function isMarkdown(file: string): boolean {
  return file.endsWith(".md");
}

function isReadme(file: string): boolean {
  return /^README/i.test(file);
}

/**
 * Pulls the first markdown H1/H2/H3 heading from the top of a file (within the
 * first 20 lines). Strips bold/italic markers and trims to a reasonable length
 * so the per-section comment stays a tight one-liner the model can parse as a
 * descriptor rather than padding.
 */
function extractFirstHeading(content: string, maxLen = 120): string | null {
  const lines = content.split("\n");
  const limit = Math.min(lines.length, 20);
  for (let i = 0; i < limit; i++) {
    const m = lines[i].match(/^#{1,3}\s+(.+?)\s*$/);
    if (!m) continue;
    let title = m[1].replace(/\*\*/g, "").replace(/\*/g, "").trim();
    if (title.length > maxLen) {
      title = title.slice(0, maxLen - 1).trimEnd() + "…";
    }
    return title;
  }
  return null;
}

function buildSectionMarker(relPath: string, content: string): string {
  const title = extractFirstHeading(content);
  return title ? `<!-- ${relPath} — ${title} -->` : `<!-- ${relPath} -->`;
}

async function readMarkdownDirRecursive(dir: string): Promise<string> {
  let entries: { relPath: string }[];
  try {
    const dirents = await fs.readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    entries = dirents
      .filter(
        (d) => d.isFile() && isMarkdown(d.name) && !isReadme(d.name),
      )
      .map((d) => ({
        relPath: path.relative(dir, path.join(d.parentPath, d.name)),
      }));
  } catch {
    return "";
  }
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  const parts = await Promise.all(
    entries.map(async ({ relPath }) => {
      const content = (await fs.readFile(path.join(dir, relPath), "utf-8")).trim();
      return `${buildSectionMarker(relPath, content)}\n${content}\n`;
    }),
  );
  return parts.join("\n");
}

async function fetchPrepFromBlob(): Promise<string> {
  const now = Date.now();
  if (blobCache && blobCache.expiresAt > now) return blobCache.content;

  const result = await list({ prefix: `${BLOB_PREFIX}/` });
  const blobs = result.blobs
    .filter((b) => isMarkdown(b.pathname))
    .filter((b) => !isReadme(path.basename(b.pathname)))
    .sort((a, b) => a.pathname.localeCompare(b.pathname));

  // Private store: use the SDK's authenticated `get()` (the URLs returned
  // by `list()` are not directly fetchable for private blobs — they 403).
  const parts = await Promise.all(
    blobs.map(async (b) => {
      const result = await get(b.pathname, { access: "private" });
      if (!result) {
        throw new Error(`Blob get returned null for ${b.pathname}`);
      }
      const text = (await new Response(result.stream).text()).trim();
      const relPath = b.pathname.startsWith(`${BLOB_PREFIX}/`)
        ? b.pathname.slice(BLOB_PREFIX.length + 1)
        : b.pathname;
      return `${buildSectionMarker(relPath, text)}\n${text}\n`;
    }),
  );

  const content = parts.join("\n");
  blobCache = { content, expiresAt: now + CACHE_TTL_MS };
  return content;
}

export async function assembleSystemPrompt(): Promise<string> {
  const publicParts = await Promise.all(
    PUBLIC_PROMPT_DIRS.map(readMarkdownDirRecursive),
  );
  const publicPart = publicParts.filter(Boolean).join("\n---\n\n");

  let privatePart = "";
  const localDir = process.env.MCF_PREP_DIR;
  if (localDir) {
    privatePart = await readMarkdownDirRecursive(localDir);
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    privatePart = await fetchPrepFromBlob();
  }

  return [publicPart, privatePart].filter(Boolean).join("\n---\n\n");
}

/** Force the next call to refetch from Blob (admin-zone hook). */
export function invalidatePrepCache(): void {
  blobCache = null;
}
