import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { query } from "@/lib/db";
import type { DocumentAnalysis, TradingDocument } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recordType: { type: "string", enum: ["cost", "payout", "unknown"] },
    propFirm: { type: "string" },
    program: { type: "string" },
    accountSize: { type: "string" },
    accountType: { type: "string" },
    market: { type: "string" },
    strategy: { type: "string" },
    feeType: { type: "string" },
    amount: { type: "number" },
    currency: { type: "string", enum: ["CZK", "EUR", "USD"] },
    date: { type: "string" },
    split: { type: "number" },
    suggestedStatus: {
      type: "string",
      enum: ["", "challenge", "verification", "funded", "failed", "payout received", "refunded", "archived"],
    },
    confidence: { type: "number" },
    explanation: { type: "string" },
  },
  required: [
    "recordType",
    "propFirm",
    "program",
    "accountSize",
    "accountType",
    "market",
    "strategy",
    "feeType",
    "amount",
    "currency",
    "date",
    "split",
    "suggestedStatus",
    "confidence",
    "explanation",
  ],
};

function fallbackAnalysis(document: DocumentRow): DocumentAnalysis {
  const lower = document.file_name.toLowerCase();
  const payout = /payout|withdraw|vyplat|profit/.test(lower);
  const cost = /invoice|fee|challenge|reset|faktura|ucet|účet/.test(lower);

  return {
    recordType: payout ? "payout" : cost ? "cost" : "unknown",
    propFirm: "",
    program: "",
    accountSize: "",
    accountType: "",
    market: "",
    strategy: "",
    feeType: "",
    amount: 0,
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    split: 80,
    suggestedStatus: payout ? "payout received" : "",
    confidence: 15,
    explanation: "Fallback podle názvu souboru. Přesnější data doplň ručně.",
  };
}

function normalizeAnalysis(value: Partial<DocumentAnalysis>): DocumentAnalysis {
  const currency = value.currency === "CZK" || value.currency === "USD" ? value.currency : "EUR";
  const recordType =
    value.recordType === "cost" || value.recordType === "payout" ? value.recordType : "unknown";

  return {
    recordType,
    propFirm: String(value.propFirm ?? "").slice(0, 160),
    program: String(value.program ?? "").slice(0, 160),
    accountSize: String(value.accountSize ?? "").slice(0, 80),
    accountType: String(value.accountType ?? "").slice(0, 80),
    market: String(value.market ?? "").slice(0, 80),
    strategy: String(value.strategy ?? "").slice(0, 120),
    feeType: String(value.feeType ?? "").slice(0, 120),
    amount: Number.isFinite(Number(value.amount)) ? Number(value.amount) : 0,
    currency,
    date:
      typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
        ? value.date
        : new Date().toISOString().slice(0, 10),
    split: Number.isFinite(Number(value.split)) ? Math.max(0, Math.min(100, Number(value.split))) : 80,
    suggestedStatus:
      value.suggestedStatus === "challenge" ||
      value.suggestedStatus === "verification" ||
      value.suggestedStatus === "funded" ||
      value.suggestedStatus === "failed" ||
      value.suggestedStatus === "payout received" ||
      value.suggestedStatus === "refunded" ||
      value.suggestedStatus === "archived"
        ? value.suggestedStatus
        : "",
    confidence: Number.isFinite(Number(value.confidence))
      ? Math.max(0, Math.min(100, Math.round(Number(value.confidence))))
      : 0,
    explanation: String(value.explanation ?? "").slice(0, 500),
  };
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await query<DocumentRow>(
    `SELECT id, file_name, file_url, file_path, content_type, file_size, ai_status, confidence,
            extracted_json, account_id, invoice_id, payout_id, created_at::text AS created_at
     FROM documents
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [id, user.id],
  );
  const document = existing.rows[0];
  if (!document) {
    return NextResponse.json({ error: "Dokument neexistuje nebo ti nepatří." }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    const fallback = fallbackAnalysis(document);
    await query(
      "UPDATE documents SET ai_status = 'skipped', extracted_json = $2, confidence = $3, error = $4 WHERE id = $1",
      [document.id, JSON.stringify(fallback), fallback.confidence, "OPENAI_API_KEY není nastavený."],
    );
    return NextResponse.json({
      analysis: fallback,
      warning: "OPENAI_API_KEY není nastavený. Použil jsem fallback bez AI.",
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const content =
      document.content_type.startsWith("image/")
        ? [
            {
              type: "input_text",
              text:
                "Extract prop trading invoice/payout data from this image. Return only structured data. If unknown, use empty strings and confidence below 40.",
            },
            { type: "input_image", image_url: document.file_url },
          ]
        : [
            {
              type: "input_text",
              text:
                "Extract prop trading invoice/payout data from this file. Return only structured data. If unknown, use empty strings and confidence below 40.",
            },
            {
              type: "input_file",
              file_url: document.file_url,
              filename: document.file_name,
              detail: "auto",
            },
          ];

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "trading_document_analysis",
          strict: true,
          schema: analysisSchema,
        },
      },
    } as never);
    const outputText =
      (response as { output_text?: string }).output_text ??
      JSON.stringify(response);
    const analysis = normalizeAnalysis(JSON.parse(outputText) as Partial<DocumentAnalysis>);

    const result = await query<DocumentRow>(
      `UPDATE documents
       SET ai_status = 'analyzed',
           extracted_json = $2,
           confidence = $3,
           error = NULL
       WHERE id = $1 AND user_id = $4
       RETURNING id, file_name, file_url, file_path, content_type, file_size, ai_status, confidence,
                 extracted_json, account_id, invoice_id, payout_id, created_at::text AS created_at`,
      [document.id, JSON.stringify(analysis), analysis.confidence, user.id],
    );

    return NextResponse.json({
      document: mapDocument(result.rows[0]),
      analysis,
    });
  } catch (error) {
    const fallback = fallbackAnalysis(document);
    await query(
      "UPDATE documents SET ai_status = 'failed', extracted_json = $2, confidence = $3, error = $4 WHERE id = $1",
      [
        document.id,
        JSON.stringify(fallback),
        fallback.confidence,
        error instanceof Error ? error.message.slice(0, 500) : "AI analýza selhala.",
      ],
    );
    return NextResponse.json({
      analysis: fallback,
      warning: "AI analýza selhala. Použil jsem fallback podle názvu souboru.",
    });
  }
}
