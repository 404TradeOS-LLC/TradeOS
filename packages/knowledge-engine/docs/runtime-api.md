# TradeOS Runtime - API Design Specification

This document details the REST endpoints exposed by the TradeOS Runtime layer for real-time application integrations.

---

## 1. Authentication & Protocols
* **Protocol**: HTTPS / REST
* **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
* **Access Control**: Active JWT validation verifying scope permissions (`read:runtime`, `write:runtime`).

---

## 2. API Endpoint Directory

### GET `/runtime/search`
* **Purpose**: Hybrid search (keyword + semantic vector) over cost items and assemblies.
* **Request Parameters**:
  - `query` (string): Text query.
  - `type` (string, enum): `cost-item | assembly`.
  - `category` (string, optional): Trade limit.
* **Response**: List of candidate matches with similarity ratings.

### POST `/runtime/intake`
* **Purpose**: Parse raw customer speech, voice transcripts, or photo classifications.
* **Request Body**:
  ```json
  {
    "sourceType": "VOICE | TEXT | PHOTO",
    "payload": "Need to replace 150 linear feet of cedar fencing in the back yard"
  }
  ```
* **Response**: Normalized Scope of Work parameters.

### POST `/runtime/estimate`
* **Purpose**: Compile structured estimate line items and compute pricing.
* **Request Body**:
  ```json
  {
    "assemblyId": "uuid-string",
    "dimensions": [{ "type": "length", "value": 150.0, "unit": "LF" }],
    "zipCode": "60601"
  }
  ```
* **Response**: Detailed pricing list with regional factors and scaled line items.

### POST `/runtime/proposal`
* **Purpose**: Generate scope text templates, assumptions, and exclusions.
* **Request Body**: Conforms to `proposal-language.schema.json` dependencies.
* **Response**: Contractual text blocks.

### POST `/runtime/classify`
* **Purpose**: Identify primary trade category from text scope.
* **Response**: Standard trade name and category routing logs.

### POST `/runtime/review`
* **Purpose**: Log human overrides, edits, and adjustments.
* **Request Body**:
  ```json
  {
    "estimateId": "uuid",
    "overrideType": "PRICE | QUANTITY | EXCLUSION",
    "originalValue": "150.0",
    "newValue": "165.0",
    "reason": "Customer requested extra gate layout"
  }
  ```
* **Response**: `200 OK — Override Logged`.
