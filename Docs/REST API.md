# QBin REST API Documentation

## Base URL
```
https://qbin.me
```

## Authentication
- Most endpoints require authentication via cookies except for public content viewing
- OAuth2 authentication is supported for user login

## Content Management

### Get Raw Content
```http
GET /r/{key}/{pwd}
```
Retrieves the raw content stored at the specified key.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

**Response:**
- `200`: Content retrieved successfully
- `403`: Invalid password or access denied
- `404`: Content not found

**Headers:**
- `Content-Type`: Varies based on content type
- `Content-Length`: Content length in bytes

### Get Content Type
```http
HEAD /r/{key}/{pwd}
```
Retrieves only the metadata of stored content.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

**Response Headers:**
- `Content-Type`: Content MIME type
- `Content-Length`: Content length in bytes

### Preview Content
```http
GET /p/{key}/{pwd}
```
Returns a HTML page for content preview.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

### Store Text Content
```http
POST /s/{key}/{pwd}
```
Stores text content at the specified key.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

**Headers:**
- `Content-Type`: Content MIME type
- `Content-Length`: Content length in bytes
- `x-expire`: Expiration time in seconds (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "string",
    "pwd": "string",
    "url": "string"
  }
}
```

### Upload File
```http
PUT /s/{key}/{pwd}
```
Uploads a file at the specified key.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

**Headers:**
- `Content-Type`: File MIME type
- `Content-Length`: File size in bytes
- `x-expire`: Expiration time in seconds (optional)

**Response:** Same as POST /s/{key}/{pwd}

### Delete Content
```http
DELETE /d/{key}/{pwd}
```
Deletes content at the specified key.

**Parameters:**
- `key` (required): Content access key
- `pwd` (optional): Content password

**Response:**
- `200`: Content deleted successfully
- `403`: Invalid password or access denied
- `404`: Content not found

## User Management

### OAuth2 Login
```http
GET /api/login/{provider}
```
Initiates OAuth2 login flow.

**Parameters:**
- `provider`: OAuth provider (google, github, linuxdo)

### OAuth2 Callback
```http
GET /api/login/oauth2/callback/{provider}
```
OAuth2 callback endpoint.

**Parameters:**
- `provider`: OAuth provider (google, github, linuxdo)

### Admin Login
```http
GET /api/login/admin
```
Administrator login endpoint.

## System Management

### Health Check
```http
GET /health
```
Checks system health status.

**Response:**
- `200`: System is healthy

### Data Synchronization
```http
GET /api/data/sync
```
Synchronizes data between PostgreSQL and KV store (Admin only).

**Response:**
```json
{
  "success": true,
  "stats": {
    "added": 0,
    "removed": 0,
    "unchanged": 0,
    "total": 0
  }
}
```

## Notes

1. Maximum upload size: Limited by server configuration
2. Content expiration: Can be set via `x-expire` header
3. MIME types: Must match standard MIME type format
4. Authentication: Required for all operations except public content viewing
