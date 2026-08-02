import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DocumentRow = {
  id: string;
  file_url: string;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const document = await query<DocumentRow>(
    "SELECT id, file_url FROM documents WHERE id = $1 AND user_id = $2 LIMIT 1",
    [id, user.id],
  );

  if (!document.rows[0]) {
    return NextResponse.json({ error: "Dokument neexistuje nebo ti nepatří." }, { status: 404 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await del(document.rows[0].file_url);
  }

  await query("DELETE FROM documents WHERE id = $1 AND user_id = $2", [id, user.id]);

  return NextResponse.json({ ok: true });
}
