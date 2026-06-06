# API Documentation

This document describes the API endpoints available in the Singapore startup map application.

## Base URL

All API endpoints are relative to the application base URL (e.g., `https://your-domain.com`).

## Endpoints

### GET /api/startups

Retrieves all startups from the database with optional filtering.

**Query Parameters:**
- `q` (optional): Search query to filter by name, description, or website
- `stage` (optional): Filter by funding stage (e.g., "Seed", "Series A")
- `sector` (optional): Filter by sector
- `hiring` (optional): Filter by hiring status ("1" for hiring, "0" for not hiring)

**Response:**
```json
{
  "version": 1,
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startups": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "description": "string",
      "website": "string",
      "stage": "string",
      "sectors": ["string"],
      "lat": number,
      "lng": number,
      "sourceUrl": "string | null",
      "lastEnrichedAt": "string | null",
      "linkedinUrl": "string | undefined",
      "hiring": "boolean",
      "logoUrl": "string | null",
      "addressText": "string | null",
      "locationSource": "string | null"
    }
  ]
}
```

**Example:**
```
GET /api/startups?stage=Seed&hiring=1
```

---

### GET /api/startups/lookup

Validates a public URL and checks if the host is already in the map.

**Query Parameters:**
- `url` (required): The public website URL to check

**Response:**
```json
{
  "valid": boolean,
  "exists": boolean,
  "hostname": "string"
}
```

**Example:**
```
GET /api/startups/lookup?url=https://example.com
```

---

### POST /api/startups/merge-one

Adds or updates a startup from a public website URL.

**Request Body:**
```json
{
  "url": "https://example.com",
  "agentResult": {} // Optional: result from live TinyFish agent
}
```

**Response (Success):**
```json
{
  "ok": true,
  "created": boolean,
  "name": "string",
  "alreadyOnMap": boolean // Optional
}
```

**Response (Error):**
```json
{
  "ok": false,
  "error": "string"
}
```

**Example:**
```
POST /api/startups/merge-one
Content-Type: application/json

{
  "url": "https://example.com"
}
```

---

### POST /api/admin/enrich

Runs the enrichment pipeline to discover and add startups from web search.

**Headers:**
- `x-enrich-secret` or `Authorization: Bearer <secret>`: Required authentication

**Request Body:**
```json
{
  "query": "Singapore proptech startup",
  "maxSearchPages": 2,
  "useAgent": false,
  "maxFetchUrls": 20
}
```

**Response:**
```json
{
  "ok": true,
  "searchHits": number,
  "fetched": number,
  "added": number,
  "updated": number,
  "errors": ["string"],
  "agentSkipped": boolean
}
```

**Example:**
```
POST /api/admin/enrich
Content-Type: application/json
x-enrich-secret: your-secret

{
  "query": "Singapore fintech startup",
  "maxFetchUrls": 10
}
```

---

### POST /api/tinyfish/agent-sse

Runs a live TinyFish agent with Server-Sent Events (SSE) streaming.

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
- Content-Type: `text/event-stream`
- Streams events in SSE format with event types: `PROGRESS`, `COMPLETE`, `ERROR`

**Example:**
```
POST /api/tinyfish/agent-sse
Content-Type: application/json

{
  "url": "https://example.com"
}
```

---

### GET /api/logo

Proxies favicon or logo images to avoid CORS issues for map markers.

**Query Parameters:**
- `domain` (optional): Domain to fetch favicon for (e.g., "example.com")
- `src` (optional): Custom logo URL to proxy

**Response:**
- Content-Type: Image type (e.g., `image/png`, `image/jpeg`)
- Binary image data

**Example:**
```
GET /api/logo?domain=example.com
GET /api/logo?src=https://example.com/logo.png
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Authentication

- `/api/admin/enrich` requires `ENRICH_SECRET` authentication via header
- Other endpoints are publicly accessible for read operations
- Write operations (`merge-one`) require server-side API keys (TinyFish, Supabase)
