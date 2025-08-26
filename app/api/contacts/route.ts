// app/api/contacts/route.ts
// Minimal, production-ready multi-tenant endpoint for Vercel (Next.js App Router)
// - Scopes each request to exactly one Vendasta businessId based on an API key header
// - No rate limiting
// - No single-tenant vanity routes
//
import { NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs"; // change to "edge" only if your Vendasta endpoint supports it

// ---------- Auth & Config helpers ----------
type ClientMap = Record<string, { businessId: string; label?: string }>;

function getClientMap(): ClientMap {
  const raw = process.env.CLIENT_MAP_JSON;
  if (!raw) {
    throw new Error("Missing CLIENT_MAP_JSON");
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("CLIENT_MAP_JSON must be a JSON object");
    }
    return parsed as ClientMap;
  } catch (e: any) {
    throw new Error(`Invalid CLIENT_MAP_JSON: ${e?.message || e}`);
  }
}

function authenticateAndResolveBusinessId(req: Request): { businessId: string; clientKey: string } {
  const apiKey = req.headers.get("x-client-key");
  if (!apiKey) {
    throw new Response(JSON.stringify({ error: "Missing x-client-key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Error;
  }
  const map = getClientMap();
  const entry = map[apiKey];
  if (!entry?.businessId) {
    throw new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }) as unknown as Error;
  }
  return { businessId: entry.businessId, clientKey: apiKey };
}

function assertVendastaSecrets() {
  if (!process.env.VEND_API_KEY) throw new Error("Missing VEND_API_KEY");
  if (!process.env.VEND_CONTACTS_CREATE_URL) throw new Error("Missing VEND_CONTACTS_CREATE_URL");
}

// ---------- Zod schema (whitelist) ----------
const Field = z.object({
  id: z.string().min(1),
  value: z.any(), // consider tightening specific field types as you standardize
  operation: z.enum(["always_overwrite", "set_if_empty"]).optional(),
});

const ContactCreateBody = z
  .object({
    subtype: z.string().optional(),
    fields: z.array(Field).min(1),
    searchExisting: z.array(z.string()).optional(),
    returnFields: z.array(z.string()).optional(),
    // businessId intentionally NOT accepted from client
  })
  .strict();

type ContactCreateBody = z.infer<typeof ContactCreateBody>;

// ---------- Handler ----------
export async function POST(req: NextRequest) {
  try {
    assertVendastaSecrets();

    // (1) Auth → businessId resolution
    const { businessId } = authenticateAndResolveBusinessId(req);

    // (2) Parse & validate input
    const json = await req.json();
    const parsed = ContactCreateBody.parse(json) as ContactCreateBody;

    // (3) Inject businessId server-side (ignore any businessId in body if present)
    const vendPayload = { ...parsed, businessId };

    // (4) Call Vendasta
    const r = await fetch(process.env.VEND_CONTACTS_CREATE_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vendPayload),
    });

    // Pass-through response content type & body (Vendasta errors may be text/plain)
    const contentType = r.headers.get("content-type") || "application/json";
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { "Content-Type": contentType } });
  } catch (err: any) {
    if (err instanceof Response) return err; // thrown above for auth failures

    const status = Number.isInteger(err?.status) ? err.status : 400;
    const message = err?.message ?? "Bad Request";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// (Optional) Basic CORS support if your client calls from a different origin.
// Uncomment and adapt if needed.
// export async function OPTIONS() {
//   return new Response(null, {
//     status: 204,
//     headers: {
//       "Access-Control-Allow-Origin": "*",            // tighten in prod
//       "Access-Control-Allow-Methods": "POST, OPTIONS",
//       "Access-Control-Allow-Headers": "Content-Type, x-client-key",
//       "Access-Control-Max-Age": "86400",
//     },
//   });
// }
