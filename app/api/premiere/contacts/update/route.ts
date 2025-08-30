import { NextRequest } from "next/server";
import { z } from "zod";
import { getVendastaAuthToken } from "../../../../../utils/vendasta-auth-vercel-secure";

export const runtime = "nodejs"; 

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
  if (!process.env.VEND_SERVICE_ACCOUNT_SECRET) {
    throw new Error("Missing VEND_SERVICE_ACCOUNT_SECRET - please add as Vercel Secret");
  }
  if (!process.env.VEND_CONTACTS_UPDATE_URL) throw new Error("Missing VEND_CONTACTS_UPDATE_URL");
}

// ---------- Zod schema (whitelist) ----------
const Field = z.object({
  id: z.string().min(1),
  value: z.any(), // consider tightening specific field types as you standardize
  operation: z.enum(["always_overwrite", "set_if_empty"]).optional(),
});

const ContactUpdateBody = z
  .object({
    contactId: z.string().min(1), // Required for updates
    subtype: z.string().optional(),
    fields: z.array(Field).min(1),
    returnFields: z.array(z.string()).optional(),
    // businessId intentionally NOT accepted from client
  })
  .strict();

type ContactUpdateBody = z.infer<typeof ContactUpdateBody>;

// ---------- Handler ----------
export async function PUT(req: NextRequest) {
  try {
    assertVendastaSecrets();

    // (1) Auth → businessId resolution
    const { businessId } = authenticateAndResolveBusinessId(req);

    // (2) Parse & validate input
    const json = await req.json();
    const parsed = ContactUpdateBody.parse(json) as ContactUpdateBody;

    // (3) Inject businessId server-side (ignore any businessId in body if present)
    const vendPayload = { ...parsed, businessId };

    // (4) Generate JWT token and call Vendasta
    const authToken = await getVendastaAuthToken();
    const r = await fetch(process.env.VEND_CONTACTS_UPDATE_URL!, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
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
