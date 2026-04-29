/**
 * Syncs the private prep corpus from local filesystem to Vercel Blob.
 *
 * Reads from MCF_PREP_DIR (typically the Drive-symlinked _prep/ folder),
 * uploads every .md file (skipping READMEs) to Blob under _prep/<relPath>,
 * and removes orphan blobs that no longer exist locally.
 *
 * Run: `npm run sync-prep`
 *
 * Env vars required:
 *   MCF_PREP_DIR             absolute path to the local source directory
 *   BLOB_READ_WRITE_TOKEN    auto-injected by the Vercel Blob marketplace integration
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { put, list, del } from "@vercel/blob";

const BLOB_PREFIX = "_prep";

function fail(msg: string): never {
  console.error(`[sync-prep] ${msg}`);
  process.exit(1);
}

async function main() {
  const localDir = process.env.MCF_PREP_DIR;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!localDir) fail("MCF_PREP_DIR is not set (add it to .env.local)");
  if (!token) fail("BLOB_READ_WRITE_TOKEN is not set (run `vercel env pull`)");

  const dirents = await fs.readdir(localDir, {
    recursive: true,
    withFileTypes: true,
  });

  type LocalFile = { relPath: string; absPath: string };
  const localFiles: LocalFile[] = dirents
    .filter(
      (d) =>
        d.isFile() &&
        d.name.endsWith(".md") &&
        !/^README/i.test(d.name),
    )
    .map((d) => {
      const absPath = path.join(d.parentPath, d.name);
      return { relPath: path.relative(localDir, absPath), absPath };
    });

  if (localFiles.length === 0) {
    console.warn(`[sync-prep] no .md files under ${localDir}`);
    return;
  }

  console.log(
    `[sync-prep] uploading ${localFiles.length} files under ${BLOB_PREFIX}/ …`,
  );

  await Promise.all(
    localFiles.map(async ({ relPath, absPath }) => {
      const content = await fs.readFile(absPath);
      const pathname = `${BLOB_PREFIX}/${relPath}`;
      await put(pathname, content, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/markdown; charset=utf-8",
        token,
      });
      console.log(`  ↑ ${pathname}`);
    }),
  );

  // Prune orphans: blobs in remote that are no longer in local.
  const remote = await list({ prefix: `${BLOB_PREFIX}/`, token });
  const localPathnames = new Set(
    localFiles.map((f) => `${BLOB_PREFIX}/${f.relPath}`),
  );
  const orphans = remote.blobs
    .map((b) => b.pathname)
    .filter((p) => !localPathnames.has(p));

  if (orphans.length > 0) {
    console.log(`[sync-prep] pruning ${orphans.length} orphan(s) …`);
    await Promise.all(
      orphans.map(async (p) => {
        await del(p, { token });
        console.log(`  ✗ ${p}`);
      }),
    );
  }

  console.log(`[sync-prep] done — ${localFiles.length} files synced.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
