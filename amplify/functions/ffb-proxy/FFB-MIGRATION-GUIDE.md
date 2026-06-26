# FFB API Migration Guide

## Overview
The FFB proxy handler now supports dual API versions for a seamless migration to new APIs on **July 1, 2026**.

## Architecture

### Configuration Structure
Two API configs are defined in `handler.ts`:
- **`FFB_API_V1`**: Current API (valid until June 30, 2026)
  - Base URL: `https://api.ffbridge.fr/api/v1/`
  - Token: Existing bearer token
  
- **`FFB_API_V2`**: New API (from July 1, 2026)
  - Base URL: `https://api.ffbridge.fr/api/v2/` *(TODO: confirm actual URL)*
  - Token: New bearer token *(TODO: replace when available)*
  - Optional response transformer for JSON interface changes

### Automatic Switching

The handler **automatically** switches to V2 on July 1, 2026 (UTC). No deployment required:

```typescript
const cutoffDate = new Date("2026-07-01T00:00:00Z");
const isV2Era = new Date() >= cutoffDate;
```

### Environment Override

To manually override the version during testing or troubleshooting:

```bash
# Force V1 (for testing before July 1)
FFB_API_VERSION=v1

# Force V2 (for early testing after setup)
FFB_API_VERSION=v2
```

Set via AWS Amplify Function environment:
```yaml
# amplify/functions/ffb-proxy/resource.ts
environment: {
  FFB_API_VERSION: process.env.FFB_API_VERSION || "auto"
}
```

## Centralized Fetch Function

All API calls now use `fetchFFBApi(endpoint, options?)`:

```typescript
// Simple GET
const members = await fetchFFBApi("members/12345");

// With query params
const search = await fetchFFBApi("search-members?search=John");

// POST/DELETE
await fetchFFBApi("organizations/1438/tournament/456/subscription", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ team_id: 789 })
});
```

**Features:**
- ✅ Automatically adds Authorization header with correct token/bearer
- ✅ Applies response transformations if needed
- ✅ Error logging with endpoint info
- ✅ Single source for all FFB API calls

## Response Transformations

If V2 API has different JSON interface:

```typescript
const FFB_API_V2: FFBApiConfig = {
  baseUrl: "https://api.ffbridge.fr/api/v2/",
  token: "Bearer <NEW_TOKEN>",
  responseTransformer: (data: any) => {
    // Map V2 response format to V1 format for backward compatibility
    return {
      id: data.person_id,        // V2 uses 'person_id'
      name: data.full_name,       // V2 uses 'full_name'
      email: data.email_address,  // etc...
    };
  }
};
```

## Migration Steps

### Phase 1: Before June 30, 2026
1. ✅ Refactored all endpoints to use centralized `fetchFFBApi`
2. Set environment var `FFB_API_VERSION=v1` (or omit for auto)
3. Test all existing endpoints

### Phase 2: Update V2 Details (Required)
When FFB confirms V2 API details, update in `handler.ts`:

```typescript
const FFB_API_V2: FFBApiConfig = {
  baseUrl: "https://api.ffbridge.fr/api/v2/...", // Actual URL
  token: "Bearer eyJ...", // Actual V2 token
  responseTransformer: (data) => {
    // Transform if needed
    return data;
  }
};
```

### Phase 3: Testing V2 (June 30, 2026)
```bash
FFB_API_VERSION=v2 npm test
# Verify all endpoints work with new API
```

### Phase 4: Auto-Switch (July 1, 2026 00:00 UTC)
- No action needed
- Handler automatically serves V2 responses
- V1 requests start failing gracefully with clear error logs

### Phase 5: Deprecate V1 (Post July 1)
Once confirmed stable on V2:
1. Remove `FFB_API_V1` config
2. Remove `FFB_API_VERSION` env override
3. Simplify to single config

## Error Handling

API errors are logged with context:
```
[FFB API] Error fetching competitions/organizations/1:
TypeError: fetch failed - Connection refused
```

Check logs in CloudWatch:
```
awslogs tail /aws/lambda/ffb-proxy --follow
```

## Testing Checklist

Before July 1, 2026:
- [ ] Test `GET /members/:id` 
- [ ] Test `GET /search-members?search=...`
- [ ] Test `GET /seasons`
- [ ] Test `GET /organizations/all`
- [ ] Test `GET /competitions/final-ranking`
- [ ] Test `GET /competitions/stades`
- [ ] Test `POST /organizations/1438/tournament/.../subscription`
- [ ] Test `DELETE /organizations/1438/tournament/.../subscription/:team_id`
- [ ] Verify bearer token in all responses

After updating to V2:
- [ ] Run all tests with `FFB_API_VERSION=v2`
- [ ] Verify response formats match expectations
- [ ] Check bearer token/auth headers
- [ ] Monitor error rates

## Troubleshooting

**Q: Getting 401 Unauthorized after July 1?**
- A: V2 bearer token not set or expired. Check `FFB_API_V2.token`.

**Q: Response format changed?**
- A: Use `responseTransformer` function to adapt V2 format to V1 client expectations.

**Q: Need to stay on V1 after July 1?**
- A: Set `FFB_API_VERSION=v1` environment variable (temporary workaround only).

## Related Files
- `handler.ts` - Main proxy with API configs
- `resource.ts` - Amplify function resource definition
- `package.json` - Dependencies
