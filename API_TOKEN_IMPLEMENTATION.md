# API Token Implementation - NetBox Style

## Overview
Implemented a complete API token system similar to NetBox, allowing users to generate secure 40-character tokens for programmatic API access.

## Features Implemented

### Backend (`swim_backend/core/`)

#### 1. Model (`models.py`)
- **APIToken Model** with fields:
  - `user`: ForeignKey to User (token owner)
  - `key`: 40-character unique token (auto-generated)
  - `write_enabled`: Boolean flag for write permissions
  - `expires`: Optional expiration datetime
  - `description`: Token description
  - `allowed_ips`: IP whitelist (one per line)
  - `created`: Creation timestamp
  - `last_used`: Last usage timestamp
  - `is_expired`: Property to check expiration

#### 2. API Views (`token_views.py`)
- **APITokenSerializer**:
  - Returns `key_preview` (first 8 chars) for security
  - Full key only shown on creation (`show_full_key` context)
  - Includes `user_name` and `is_expired` fields
  
- **APITokenViewSet**:
  - CRUD operations for tokens
  - User isolation (users see only their own tokens)
  - `regenerate` action to create new key
  - Custom `create` method to show full key once

#### 3. URL Configuration (`api_router.py`)
- Registered at `/api/api-tokens/`
- All standard REST endpoints available

#### 4. Database Migration
- Created and applied `0010_add_api_tokens.py`
- Table: `core_apitoken`

### Frontend (`ui/src/pages/Profile.jsx`)

#### 1. Token Creation Form
- **Description** field for token purpose
- **Write enabled** checkbox
- **Expires** datetime picker (optional)
- **Allowed IPs** textarea (optional, one per line)
- Create button to generate token

#### 2. Token Display
- List of existing tokens with:
  - Description/name
  - Key preview (first 8 chars + "...")
  - Read-only badge for non-write tokens
  - Creation date
  - Last used date
  - Expiration date (if set)
  - Delete button

#### 3. Token Creation Modal
- **One-time display** of full token
- Warning message about copying before closing
- Copy to clipboard button
- Shows token metadata (description, permissions)

#### 4. Security Features
- Token only shown once after creation
- Warning message about security
- Best practices info box
- Tokens are 40+ characters
- IP restriction support

## API Endpoints

### List Tokens
```http
GET /api/api-tokens/
Authorization: Session Cookie
```

### Create Token
```http
POST /api/api-tokens/
Content-Type: application/json

{
  "description": "CI/CD Pipeline",
  "write_enabled": true,
  "expires": "2025-12-31T23:59:59Z",
  "allowed_ips": "192.168.1.100\n10.0.0.0/24"
}
```

### Delete Token
```http
DELETE /api/api-tokens/{id}/
Authorization: Session Cookie
```

### Regenerate Token
```http
POST /api/api-tokens/{id}/regenerate/
Authorization: Session Cookie
```

## Security Considerations

1. **Token Generation**: Uses Python's `secrets` module for cryptographically secure random generation
2. **One-time Display**: Full token shown only on creation, never retrievable again
3. **User Isolation**: Users can only see and manage their own tokens
4. **Key Preview**: Only first 8 characters shown in listings
5. **Write Permissions**: Explicit flag for write access
6. **IP Restrictions**: Optional IP whitelist support
7. **Expiration**: Optional expiration datetime
8. **Token Length**: Minimum 40 characters for security

## Usage Instructions

1. **Navigate to Profile**:
   - Log in to SWIM
   - Click your username → Profile
   - Go to "API Keys" tab

2. **Create Token**:
   - Fill in description (e.g., "CI/CD Pipeline")
   - Toggle "Write enabled" if needed
   - Optionally set expiration date
   - Optionally add allowed IPs
   - Click "Create Token"

3. **Copy Token**:
   - Modal will display the full token
   - Click "Copy" button
   - Store securely (you won't see it again)
   - Click "Done" when finished

4. **Use Token**:
   ```bash
   curl -H "Authorization: Token YOUR_TOKEN_HERE" \
        http://localhost:8000/api/devices/
   ```

5. **Manage Tokens**:
   - View all your tokens in the list
   - See when each was created/used
   - Delete unused tokens
   - Check expiration status

## Database Schema

```sql
CREATE TABLE core_apitoken (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id),
    key VARCHAR(100) UNIQUE NOT NULL,
    write_enabled BOOLEAN DEFAULT TRUE,
    expires DATETIME NULL,
    description VARCHAR(255) DEFAULT '',
    allowed_ips TEXT DEFAULT '',
    created DATETIME NOT NULL,
    last_used DATETIME NULL
);
```

## Testing

1. Start servers:
   ```bash
   # Backend
   cd /home/tdebnath/swim
   python manage.py runserver
   
   # Frontend
   cd /home/tdebnath/swim/ui
   npm run dev
   ```

2. Navigate to: http://localhost:5173/
3. Login with your credentials
4. Go to Profile → API Keys
5. Create a new token
6. Verify modal displays full key
7. Verify token appears in list with preview only
8. Test token deletion

## Files Modified

- `swim_backend/core/models.py` - Added APIToken model
- `swim_backend/core/token_views.py` - Created (new file)
- `swim_backend/api_router.py` - Registered token endpoint
- `swim_backend/core/migrations/0010_add_api_tokens.py` - Created (new migration)
- `ui/src/pages/Profile.jsx` - Added token management UI

## Future Enhancements

- Token usage tracking (update `last_used` field)
- Token usage analytics
- Rate limiting per token
- Scope-based permissions (beyond read/write)
- Token audit log
- Email notifications on token creation/deletion
- IP-based access control enforcement
- Token rotation policies
