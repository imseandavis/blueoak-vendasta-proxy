import { NextRequest } from "next/server";
import { z } from "zod";

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
  if (!process.env.VEND_API_KEY) throw new Error("Missing VEND_API_KEY");
  if (!process.env.VEND_CONTACTS_GET_URL) throw new Error("Missing VEND_CONTACTS_GET_URL");
}

// ---------- Zod schema (whitelist) ----------
const ContactFetchBody = z
  .object({
    contactId: z.string().optional(), // Optional for fetching specific contact
    filters: z.record(z.any()).optional(), // Optional filters for searching
    returnFields: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
    offset: z.number().min(0).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    // businessId intentionally NOT accepted from client
  })
  .strict();

type ContactFetchBody = z.infer<typeof ContactFetchBody>;

// ---------- Handler ----------
export async function GET(req: NextRequest) {
  try {
    assertVendastaSecrets();

    // (1) Auth → businessId resolution
    const { businessId } = authenticateAndResolveBusinessId(req);

    // (2) Parse & validate query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    // Convert string values to appropriate types for validation
    const parsedQuery = {
      ...queryParams,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      offset: queryParams.offset ? parseInt(queryParams.offset) : undefined,
      filters: queryParams.filters ? JSON.parse(queryParams.filters) : undefined,
      returnFields: queryParams.returnFields ? queryParams.returnFields.split(',') : undefined,
    };

    const validated = ContactFetchBody.parse(parsedQuery);

    // (3) Inject businessId server-side
    const vendPayload = { ...validated, businessId };

    // (4) Build URL with query parameters
    const vendUrl = new URL(process.env.VEND_CONTACTS_GET_URL!);
    Object.entries(vendPayload).forEach(([key, value]) => {
      if (value !== undefined) {
        if (typeof value === 'object') {
          vendUrl.searchParams.set(key, JSON.stringify(value));
        } else {
          vendUrl.searchParams.set(key, String(value));
        }
      }
    });

    // (5) Call Vendasta
    const r = await fetch(vendUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.VEND_API_KEY}`,
        "Content-Type": "application/json",
      },
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

// Also support POST for complex queries
export async function POST(req: NextRequest) {
  try {
    assertVendastaSecrets();

    // (1) Auth → businessId resolution
    const { businessId } = authenticateAndResolveBusinessId(req);

    // (2) Parse & validate input
    const json = await req.json();
    const parsed = ContactFetchBody.parse(json) as ContactFetchBody;

    // (3) Inject businessId server-side (ignore any businessId in body if present)
    const vendPayload = { ...parsed, businessId };

    // (4) Call Vendasta
    const r = await fetch(process.env.VEND_CONTACTS_GET_URL!, {
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
