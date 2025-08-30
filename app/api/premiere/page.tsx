export default function Page() {
  return (
    <main style={{padding: 24}}>
      <h1>Premiere Placements Contact API</h1>
      
      <h2>Overview</h2>
      <p>
        This API provides endpoints for managing contacts in the Premiere Placements CRM system. 
        All endpoints require authentication via the <code>x-client-key</code> header.
      </p>

      <h2>Authentication</h2>
      <p>
        Include your API key in the request header:
        <br />
        <code>x-client-key: your-api-key</code>
      </p>

      <h2>Endpoints</h2>
      
      <h3>POST /api/premiere/contacts/upsert</h3>
      <p>Create or update a contact. If a contact with the specified search criteria exists, it will be updated; otherwise, a new contact will be created.</p>
      
      <h4>Request Body</h4>
      <pre style={{backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px', overflow: 'auto'}}>
{`{
  "fields": [
    {
      "id": "string",           // Field identifier (e.g., "standard__first_name")
      "value": "string",        // Most values are passed as string. In the case of lists and tags you can add a '[' and ']' surrounding the values. In the case of geopoints, '[]' surrounding two numeric values (lat,long). In the case of currency values, this value accepts the format '{ currencyCode : "USD", amount : 000 } where amount is a numeric value.
      "operation": "string"     // Optional: "always_overwrite" | "overwrite_if_empty" | "overwrite_if_newer" | "combine"
    }
  ],
  "searchExisting": ["string"], // Array of field IDs to search for existing contact
  "returnFields": ["string"],   // Array of field IDs to return in response (A list of fields that should have their merged values returned in the response. If empty no fields will be returned.)
}`}
      </pre>

      <h4>Example Request</h4>
      <pre style={{backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px', overflow: 'auto'}}>
{`curl -X POST "https://clientapi.blueoakmarketing.com/api/premiere/contacts/upsert" \\
  -H "x-client-key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"fields":[{"id":"standard__first_name","value":"John","operation":"always_overwrite"},{"id":"standard__last_name","value":"Doe","operation":"always_overwrite"},{"id":"standard__email","value":"john.doe@example.com","operation":"always_overwrite"}],"searchExisting":["standard__email"],"returnFields":["standard__email","standard__first_name","standard__last_name"],"upsertStrategy":"create_or_update"}'`}
      </pre>

      <h4>Example Response</h4>
      <pre style={{backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px', overflow: 'auto'}}>
{`{"fields":[{"id":"standard__first_name","value":"John"}, {"id":"standard__email","value":"john.doe@example.com"}]}`}
      </pre>

      <h3>Other Endpoints</h3>
      <ul>
        <li>(PENDING V2 Approval) <strong>POST /api/premiere/contacts/create</strong> - Create a new contact</li>
        <li>(PENDING V2 Approval) <strong>PUT /api/premiere/contacts/update</strong> - Update an existing contact</li>
        <li>(PENDING V2 Approval) <strong>DELETE /api/premiere/contacts/delete</strong> - Delete a contact</li>
        <li>(PENDING V2 Approval) <strong>GET /api/premiere/contacts/get</strong> - Get a contact</li>
        <li>(PENDING V2 Approval) <strong>POST /api/premiere/contacts/list</strong> - List contacts based on filter</li>
      </ul>

      <h2>Response Format</h2>
      <p>
        All endpoints return JSON responses. Successful requests return the requested data, 
        while errors return an error object with a descriptive message.
      </p>

      <h2>Error Codes</h2>
      <ul>
        <li><strong>401</strong> - Missing or invalid API key</li>
        <li><strong>403</strong> - Insufficient permissions</li>
        <li><strong>400</strong> - Invalid request format</li>
        <li><strong>500</strong> - Internal server error</li>
      </ul>
    </main>
  );
}
