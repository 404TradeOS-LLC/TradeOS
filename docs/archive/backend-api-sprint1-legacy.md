---
status: archived
superseded_by: docs/API_REFERENCE.md
do_not_use_for_implementation: true
---

# Backend API Sprint 1

## Overview

Sprint 1 adds backend-only foundations for authentication, tenant-aware account/company administration, customer CRM, customer import, and related records.

Base path: `/api/v1`

Authentication:
- Public routes: `/auth/*`
- Protected routes: require `Authorization: Bearer <token>`
- Protected routes run through organization membership resolution plus request-scoped RLS

Roles:
- `owner`
- `admin`
- `dispatcher`
- `technician`

## Auth Routes

### `POST /api/v1/auth/signup`

Auth: none

Request:
```json
{
  "organizationName": "Acme Services",
  "regionCode": "US-IN-INDIANAPOLIS",
  "email": "owner@example.com",
  "password": "super-secret-1",
  "fullName": "Owner Person"
}
```

Response:
```json
{
  "token": "jwt",
  "refreshToken": "opaque-refresh-token",
  "user": {
    "id": "user-id",
    "email": "owner@example.com",
    "fullName": "Owner Person"
  },
  "organization": {
    "id": "org-id",
    "name": "Acme Services"
  },
  "role": "owner"
}
```

### `POST /api/v1/auth/login`

Auth: none

Request:
```json
{
  "email": "owner@example.com",
  "password": "super-secret-1"
}
```

Response: same shape as signup

### `POST /api/v1/auth/refresh`

Auth: none

Request:
```json
{
  "refreshToken": "opaque-refresh-token"
}
```

Response: same shape as signup with rotated `refreshToken`

### `POST /api/v1/auth/password-reset/request`

Auth: none

Request:
```json
{
  "email": "owner@example.com"
}
```

Response:
```json
{
  "success": true
}
```

In non-production environments the response may also include a `resetToken` for local testing.

### `POST /api/v1/auth/password-reset/confirm`

Auth: none

Request:
```json
{
  "token": "password-reset-token",
  "password": "new-super-secret-1"
}
```

Response:
```json
{
  "success": true
}
```

### `POST /api/v1/auth/bootstrap`

Auth: bearer token from external identity bootstrap flow

Request:
```json
{
  "organizationName": "Acme Services",
  "regionCode": "US-IN-INDIANAPOLIS",
  "fullName": "Bootstrap Owner"
}
```

Response:
```json
{
  "user": {
    "id": "user-id",
    "email": "owner@example.com",
    "fullName": "Bootstrap Owner"
  },
  "organization": {
    "id": "org-id",
    "name": "Acme Services"
  },
  "role": "owner"
}
```

## Invite Routes

### `POST /api/v1/account/invites`

Auth: bearer token required
Required role: `owner`

Request:
```json
{
  "email": "dispatcher@example.com",
  "role": "dispatcher"
}
```

Response:
```json
{
  "inviteId": "invite-id",
  "email": "dispatcher@example.com",
  "role": "dispatcher",
  "expiresAt": "2026-07-21T00:00:00.000Z"
}
```

In non-production environments the response may also include an `inviteToken`.

### `POST /api/v1/auth/invites/accept`

Auth: none

Request:
```json
{
  "token": "invite-token",
  "password": "super-secret-1",
  "fullName": "New Dispatcher"
}
```

Response: same shape as signup

## Account and Company Routes

### `GET /api/v1/account/2fa`

Auth: bearer token required
Required role: any authenticated member

Response:
```json
{
  "enabled": false,
  "message": "TOTP storage is scaffolded. Secret generation, verification, and recovery codes remain future work."
}
```

### `GET /api/v1/company`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

Response:
```json
{
  "companyName": "Acme Services",
  "phone": "317-555-0100",
  "email": "owner@example.com",
  "address": "101 Main Street",
  "logoUrl": "",
  "primaryColor": "#112233",
  "secondaryColor": "#445566",
  "storage": {
    "logoUpload": "not_configured",
    "message": "No storage adapter is configured. Implement CompanyLogoStorageAdapter before enabling binary uploads."
  }
}
```

### `PATCH /api/v1/company`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request:
```json
{
  "companyName": "Acme Services",
  "phone": "317-555-0100",
  "email": "owner@example.com",
  "address": "101 Main Street",
  "primaryColor": "#112233",
  "secondaryColor": "#445566"
}
```

Response: same shape as `GET /company`

## Customer CRM Routes

### `GET /api/v1/customers`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

Response:
```json
[
  {
    "id": "customer-id",
    "name": "Jane Homeowner",
    "email": "jane@example.com",
    "phone": "317-555-0101"
  }
]
```

### `POST /api/v1/customers`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request:
```json
{
  "name": "Jane Homeowner",
  "email": "jane@example.com",
  "phone": "317-555-0101",
  "address": "101 Main Street",
  "billingAddress": "101 Main Street",
  "notes": "Prefers text updates"
}
```

Response: created customer row

### `GET /api/v1/customers/:id`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

Response includes:
- customer
- related projects
- service addresses
- equipment
- customer notes

### `PATCH /api/v1/customers/:id`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request: partial customer fields

### `DELETE /api/v1/customers/:id`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Behavior: soft delete via `deleted_at`

## Service Address Routes

### `POST /api/v1/customers/:id/service-addresses`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request:
```json
{
  "label": "Primary",
  "addressLine1": "101 Main Street",
  "city": "Indianapolis",
  "state": "IN",
  "postalCode": "46201",
  "isPrimary": true
}
```

### `PATCH /api/v1/customers/:id/service-addresses/:addressId`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request: partial service-address fields

### `DELETE /api/v1/customers/:id/service-addresses/:addressId`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Behavior: soft delete via `deleted_at`

## Equipment Routes

### `POST /api/v1/customers/:id/equipment`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request:
```json
{
  "serviceAddressId": "address-id",
  "name": "Furnace",
  "manufacturer": "Carrier",
  "model": "X100",
  "serialNumber": "ABC123",
  "status": "active",
  "notes": "Installed in 2024"
}
```

### `PATCH /api/v1/customers/:id/equipment/:equipmentId`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request: partial equipment fields

### `DELETE /api/v1/customers/:id/equipment/:equipmentId`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Behavior: soft delete via `deleted_at`

## Notes Routes

### `GET /api/v1/notes?entityType=customer&entityId=<uuid>`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

Supported `entityType` values:
- `customer`
- `job`

### `POST /api/v1/notes`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

Request:
```json
{
  "entityType": "customer",
  "entityId": "customer-id",
  "body": "Customer asked for Friday morning service."
}
```

### `GET /api/v1/jobs/:id/notes`

Auth: bearer token required
Required role: `owner`, `dispatcher`, `technician`

### `POST /api/v1/jobs/:id/notes`

Auth: bearer token required
Required role: any authenticated member

Request:
```json
{
  "body": "Technician called ahead and is en route."
}
```

## CSV Customer Import

### `POST /api/v1/import/customers/`

Auth: bearer token required
Required role: `owner`, `dispatcher`

Request:
```json
{
  "csvContent": "name,phone,email,address\nJane,317-555-0101,jane@example.com,101 Main Street"
}
```

Response:
```json
{
  "successCount": 1,
  "duplicateCount": 0,
  "malformedRows": []
}
```

Duplicate detection:
- phone
- email

Malformed rows are returned with row number and message.

## Payment and Service Agreement Routes

These routes are part of the current backend tree, though they are adjacent to the original Sprint 1 ask.

### `GET /api/v1/customers/:id/service-agreements`
### `POST /api/v1/customers/:id/service-agreements`
### `GET /api/v1/invoices/:id/payments`
### `POST /api/v1/invoices/:id/payments`

Auth: bearer token required

Roles:
- service agreements read: `owner`, `dispatcher`, `technician`
- service agreements write: `owner`, `dispatcher`
- payments read: `owner`, `dispatcher`, `technician`
- payments write: `owner`, `dispatcher`

## Known Limitations

- TOTP is scaffolded only. There is no secret enrollment, verification, or recovery-code flow yet.
- Company logo upload uses a storage adapter interface only. No concrete storage backend is wired yet.
- Job notes currently use the generic comment model with `entityType = "job"`.
