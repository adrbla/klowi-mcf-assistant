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
 * Phase 1: skeleton only. Wired in Phase 2.
 */

const PROJECT_ROOT = process.cwd();
const PUBLIC_PROMPT_DIR = path.join(PROJECT_ROOT, "context", "prompt");
const PRIVATE_PREP_DIR = path.join(PROJECT_ROOT, "mcf", "AUDITIONS (!!)", "_prep");

async function readMarkdownDir(dir: string): Promise<string> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return "";
  }
  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const parts = await Promise.all(
    mdFiles.map(async (f) => {
      const content = await fs.readFile(path.join(dir, f), "utf-8");
      return `<!-- ${f} -->\n${content.trim()}\n`;
    })
  );
  return parts.join("\n");
}

export async function assembleSystemPrompt(): Promise<string> {
  const [publicPart, privatePart] = await Promise.all([
    readMarkdownDir(PUBLIC_PROMPT_DIR),
    readMarkdownDir(PRIVATE_PREP_DIR),
  ]);
  return [publicPart, privatePart].filter(Boolean).join("\n---\n\n");
}
