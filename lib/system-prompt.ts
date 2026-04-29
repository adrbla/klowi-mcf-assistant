import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Assembles the coach system prompt from two sources:
 *  1. context/prompt/*.md   — public, committed scaffold (coach behavior, formats, factual COS).
 *  2. mcf/AUDITIONS (!!)/_prep/**.md — private, runtime-only (strategy, drafts, intimate notes).
 *
 * Both are concatenated in numeric-prefix order. The result is fed to Anthropic with prompt
 * caching breakpoints so re-injecting it on every turn stays cheap.
 *
 * The private prep directory path is resolved from MCF_PREP_DIR at runtime — keeping the path
 * out of source code prevents Turbopack from trying to trace it at build time (the `mcf/`
 * symlink crosses the Google Drive boundary, which Turbopack's static analyzer rejects).
 */

const PUBLIC_PROMPT_DIR = path.join(process.cwd(), "context", "prompt");

async function readMarkdownDir(dir: string): Promise<string> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return "";
  }
  const mdFiles = entries
    .filter((f) => f.endsWith(".md"))
    // README files are docs about the directory, not prompt content.
    .filter((f) => !/^README/i.test(f))
    .sort();
  const parts = await Promise.all(
    mdFiles.map(async (f) => {
      const content = await fs.readFile(path.join(dir, f), "utf-8");
      return `<!-- ${f} -->\n${content.trim()}\n`;
    })
  );
  return parts.join("\n");
}

export async function assembleSystemPrompt(): Promise<string> {
  const privateDir = process.env.MCF_PREP_DIR ?? "";
  const [publicPart, privatePart] = await Promise.all([
    readMarkdownDir(PUBLIC_PROMPT_DIR),
    privateDir ? readMarkdownDir(privateDir) : Promise.resolve(""),
  ]);
  return [publicPart, privatePart].filter(Boolean).join("\n---\n\n");
}
