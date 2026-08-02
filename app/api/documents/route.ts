import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";
import { optionalText } from "@/lib/validators";
import type { DocumentAnalysis, TradingDocument } from "@/lib/types";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
  "text/csv",
]);
const maxBytes = 10 * 1024 * 1024;

type DocumentRow = {
  id: string;
  file_name: string;
  file_url: string;
  file_path: string;
  content_type: string;
  file_size: number;
  ai_status: TradingDocument["aiStatus"];
  confidence: number;
  extracted_json: DocumentAnalysis | null;
  account_id: string | null;
  invoice_id: string | null;
  payout_id: string | null;
  created_at: string;
};

function mapDocument(row: DocumentRow): TradingDocument {
  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    filePath: row.file_path,
    contentType: row.content_type,
    fileSize: Number(row.file_size),
    aiStatus: row.ai_status,
    confidence: Number(row.confidence),
    extractedJson: row.extracted_json,
    accountId: row.account_id,
    invoiceId: row.invoice_id,
    payoutId: row.payout_id,
    createdAt: row.created_at,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const result = await query<DocumentRow>(
    `SELECT id, file_name, file_url, file_path, content_type, file_size, ai_status, confidence,
            extracted_json, account_id, invoice_id, payout_id, created_at::text AS created_at
     FROM documents
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [user.id],
  );

  return NextResponse.json({ documents: result.rows.map(mapDocument) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob není nastavený. Přidej BLOB_READ_WRITE_TOKEN ve Vercelu." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const accountId = optionalText(formData.get("accountId"), 80);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nahraj PDF, obrázek nebo textový soubor." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json({ error: "Soubor musí mít maximálně 10 MB." }, { status: 400 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!allowedTypes.has(contentType) && !file.name.match(/\.(pdf|png|jpe?g|txt|csv)$/i)) {
    return NextResponse.json(
      { error: "Podporuji PDF, PNG/JPG, TXT a CSV." },
      { status: 400 },
    );
  }
  if (accountId) {
    const account = await query<{ id: string }>(
      "SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1",
      [accountId, user.id],
    );
    if (!account.rows[0]) {
      return NextResponse.json(
        { error: "Vybraný účet neexistuje nebo ti nepatří." },
        { status: 400 },
      );
    }
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `documents/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: false,
  });
  const id = crypto.randomUUID();
  const result = await query<DocumentRow>(
    `INSERT INTO documents
       (id, user_id, account_id, file_name, file_url, file_path, content_type, file_size, ai_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING id, file_name, file_url, file_path, content_type, file_size, ai_status, confidence,
               extracted_json, account_id, invoice_id, payout_id, created_at::text AS created_at`,
    [
      id,
      user.id,
      accountId,
      file.name,
      blob.url,
      blob.pathname,
      contentType,
      file.size,
    ],
  );

  return NextResponse.json({ document: mapDocument(result.rows[0]) });
}
