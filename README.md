# Blue Oak Vendasta Proxy (Next.js App Router)

A turnkey, multi-tenant API proxy that scopes Vendasta requests to a single **Business Location** per client.  
**No rate limiting** and **no single-tenant vanity routes**, as requested.

## What you get
- Next.js (App Router, TypeScript)
- `POST /api/contacts` — forwards to Vendasta contacts endpoint
- Per-client API key header → injects the correct `businessId` server-side
- Zod validation + strict whitelist
- Minimal UI home page for sanity check

## Quick start (local)

1. **Install deps**
   ```bash
   npm i
   # or: pnpm i / yarn
   ```

2. **Copy env file**
   ```bash
   cp .env.example .env.local
   ```
   Fill in:
   - `VEND_API_KEY`
   - `VEND_CONTACTS_CREATE_URL` (e.g. `https://api.vendasta.com/contacts/v1/create`)
   - `CLIENT_MAP_JSON` — a JSON object mapping client API keys → businessId

3. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

4. **Test the endpoint**
   ```bash
   curl -X POST "http://localhost:3000/api/contacts"      -H "x-client-key: acme_live_8f2f5..."      -H "Content-Type: application/json"      -d '{
       "subtype": "",
       "fields": [
         { "id": "standard__first_name", "value": "Sean", "operation": "always_overwrite" },
         { "id": "standard__last_name", "value": "Davis", "operation": "always_overwrite" },
         { "id": "standard__email", "value": "sean@example.com", "operation": "always_overwrite" },
         { "id": "standard__phone_number", "value": "+19415551212" }
       ],
       "searchExisting": ["standard__email"],
       "returnFields": ["standard__email","standard__first_name","standard__last_name"]
     }'
   ```

## Deploy to Vercel

1. Create a new Vercel project and import this repo.
2. Set **Environment Variables** (Project → Settings → Environment Variables):
   - `VEND_API_KEY` – *Server*
   - `VEND_CONTACTS_CREATE_URL` – *Server*
   - `CLIENT_MAP_JSON` – *Server*
3. Deploy. The endpoint will be at:
   ```
   https://api.blueoakmarketing.com/api/contacts
   ```

> **Security tips**
> - Never expose your Vendasta key to browsers or clients.
> - Do not accept `businessId` from the client; this project injects it server-side.
> - Rotate client API keys periodically and update `CLIENT_MAP_JSON`.
> - Consider IP allowlisting or mTLS at your edge if you need stronger controls.

## File structure
```
app/
  api/
    contacts/
      route.ts       # the endpoint
  layout.tsx         # minimal layout
  page.tsx           # placeholder home page
next.config.mjs
tsconfig.json
package.json
.env.example
```

