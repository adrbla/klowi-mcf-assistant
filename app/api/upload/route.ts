import "server-only";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import {
  MAX_ATTACHMENT_BYTES,
  isAcceptedExtension,
  isAcceptedMime,
  resolveMime,
  extensionFromName,
} from "@/lib/attachments";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json(
      { error: "BLOB_READ_WRITE_TOKEN not configured" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing file" }, { status: 400 });
  }

  // Validate size (server-side filet de sécurité; client also validates).
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json(
      {
        error: `file too large (${file.size} bytes; max ${MAX_ATTACHMENT_BYTES})`,
      },
      { status: 413 },
    );
  }

  // Validate extension and resolve MIME (browsers vary on .md → text/markdown).
  if (!isAcceptedExtension(file.name)) {
    return Response.json(
      { error: "unsupported file type — accepted: .pdf, .md, .txt" },
      { status: 400 },
    );
  }
  const mediaType = resolveMime(file.name, file.type);
  if (!isAcceptedMime(mediaType)) {
    return Response.json(
      { error: "unsupported MIME type" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const ext = extensionFromName(file.name); // includes the dot
  const blobPath = `attachments/${id}${ext}`;

  const buffer = await file.arrayBuffer();
  await put(blobPath, buffer, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: mediaType,
    token,
  });

  return Response.json({
    id,
    name: file.name,
    mediaType,
    sizeBytes: file.size,
    blobPath,
  });
}
