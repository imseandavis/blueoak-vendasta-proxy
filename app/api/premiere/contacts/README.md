# Contact API Endpoints

This directory contains 5 separate endpoints for managing contacts in the Vendasta CRM system. All endpoints require authentication via the `x-client-key` header.

## Authentication

All endpoints require the `x-client-key` header for authentication. The API key maps to a business ID in the system configuration.

## Endpoints

### 1. Create Contact
**POST** `/api/premiere/contacts/create`

Creates a new contact record in the CRM.

**Request Body:**
```json
{
  "subtype": "string (optional)",
  "fields": [
    {
      "id": "field_id",
      "value": "field_value",
      "operation": "always_overwrite|set_if_empty (optional)"
    }
  ],
  "searchExisting": ["field1", "field2"] (optional),
  "returnFields": ["field1", "field2"] (optional)
}
```

### 2. Update Contact
**PUT** `/api/premiere/contacts/update`

Updates an existing contact record in the CRM.

**Request Body:**
```json
{
  "contactId": "required_contact_id",
  "subtype": "string (optional)",
  "fields": [
    {
      "id": "field_id",
      "value": "field_value",
      "operation": "always_overwrite|set_if_empty (optional)"
    }
  ],
  "returnFields": ["field1", "field2"] (optional)
}
```

### 3. Delete Contact
**DELETE** `/api/premiere/contacts/delete`

Deletes an existing contact record from the CRM.

**Request Body:**
```json
{
  "contactId": "required_contact_id"
}
```

### 4. Get Contacts
**GET** `/api/premiere/contacts/get`

Gets contact records from the CRM. Supports both GET (with query parameters) and POST (with request body) methods.

**GET Query Parameters:**
- `contactId` (optional): Specific contact ID to get
- `filters` (optional): JSON string of filter criteria
- `returnFields` (optional): Comma-separated list of fields to return
- `limit` (optional): Number of records to return (1-1000)
- `offset` (optional): Number of records to skip
- `sortBy` (optional): Field to sort by
- `sortOrder` (optional): "asc" or "desc"

**POST Request Body:**
```json
{
  "contactId": "string (optional)",
  "filters": "object (optional)",
  "returnFields": ["field1", "field2"] (optional),
  "limit": "number (optional, 1-1000)",
  "offset": "number (optional, >= 0)",
  "sortBy": "string (optional)",
  "sortOrder": "asc|desc (optional)"
}
```

### 5. Upsert Contact
**POST** `/api/premiere/contacts/upsert`

Creates a new contact or updates an existing one based on search criteria. This combines create and update functionality.

**Request Body:**
```json
{
  "contactId": "string (optional)",
  "subtype": "string (optional)",
  "fields": [
    {
      "id": "field_id",
      "value": "field_value",
      "operation": "always_overwrite|set_if_empty (optional)"
    }
  ],
  "searchExisting": ["field1", "field2"] (optional),
  "returnFields": ["field1", "field2"] (optional),
  "upsertStrategy": "create_if_not_exists|update_if_exists|create_or_update (optional)"
}
```

## Environment Variables Required

The following environment variables must be configured:

- `CLIENT_MAP_JSON`: JSON mapping of API keys to business IDs
- `VEND_SERVICE_ACCOUNT_JSON`: Complete Google Service Account JSON file content (for JWT authentication)
- `VEND_CONTACTS_CREATE_URL`: Vendasta contacts create endpoint URL
- `VEND_CONTACTS_UPDATE_URL`: Vendasta contacts update endpoint URL
- `VEND_CONTACTS_DELETE_URL`: Vendasta contacts delete endpoint URL
- `VEND_CONTACTS_GET_URL`: Vendasta contacts get endpoint URL
- `VEND_CONTACTS_UPSERT_URL`: Vendasta contacts upsert endpoint URL

## Authentication Setup

The API uses a two-step OAuth 2.0 JWT Bearer flow with Google Service Account credentials:

### Step 1: Generate JWT Assertion
The system creates a JWT assertion using your service account credentials:
- **Issuer (iss)**: Your service account email
- **Subject (sub)**: Your service account email  
- **Audience (aud)**: The token URI from your service account JSON
- **Expiration**: 5 minutes from generation
- **Algorithm**: RS256
- **Additional claims**: `nbf` (not before), `jti` (unique identifier)

### Step 2: Exchange for Access Token
The JWT assertion is exchanged for an access token using the OAuth 2.0 token endpoint.

### Required Fields in Service Account JSON:
- `private_key`: The private key for signing JWT assertions
- `client_email`: The service account email (used as issuer and subject)
- `private_key_id`: Key ID for the JWT header
- `token_uri`: The OAuth 2.0 token endpoint URL
- Other standard Google Service Account fields

## Error Handling

All endpoints return appropriate HTTP status codes and error messages. Authentication failures return 401/403 status codes, while validation errors return 400 status codes.

## Response Format

All endpoints pass through the Vendasta API response directly, maintaining the original content type and response format.
