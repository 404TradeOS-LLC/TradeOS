# TradeOS Knowledge Engine - API Design Specification

This document details the REST API endpoints exposed by the Knowledge Engine to power estimators, proposal generators, and AI agents.

---

## 1. Authentication & Security
* **Protocol**: Bearer Token via HTTPS.
* **Token Type**: JWT signed by TradeOS Identity Service.
* **Roles**: `read:knowledge`, `write:knowledge` (restricted to orchestrator), `admin:knowledge`.

---

## 2. API Endpoints

### GET `/assemblies/search`
* **Purpose**: Query assemblies with keyword and hybrid ranking.
* **Request Parameters**:
  - `query` (string): Text search term.
  - `category` (string, optional): Trade filter.
  - `page` (integer, default 1)
  - `limit` (integer, default 20)
* **Response**:
  ```json
  {
    "data": [
      { "id": "uuid", "name": "Large Tree Removal", "score": 0.89 }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1 }
  }
  ```

### GET `/assemblies/{id}`
* **Purpose**: Retrieve full details of a specific assembly.
* **Response**: Conforms to `assembly.schema.json`.

### GET `/cost-items/search`
* **Purpose**: Search for individual costbook items.
* **Request Parameters**:
  - `query`, `category`, `unit`, `page`, `limit`.
* **Response**: List of items conforming to `cost-item.schema.json`.

### POST `/reason/scope`
* **Purpose**: Parse raw user query to extract structured parameters.
* **Request Body**:
  ```json
  { "text": "Need to cut down a 25 inch maple tree in front yard" }
  ```
* **Response**:
  ```json
  {
    "dimensions": [{ "type": "DBH", "value": 25.0, "unit": "IN" }],
    "materials": [],
    "siteConstraints": ["front yard"]
  }
  ```

### POST `/reason/proposal`
* **Purpose**: Generate proposal text templates.
* **Request Body**:
  ```json
  { "assemblyId": "uuid", "siteConstraints": ["power lines"] }
  ```
* **Response**: Conforms to `proposal-language.schema.json`.

### POST `/match/assembly`
* **Purpose**: Match a parsed scope to the best assembly candidate.
* **Request Body**:
  ```json
  { "parsedScope": { "DBH": 25.0 } }
  ```
* **Response**: Selected assembly details with confidence score.

### POST `/retrieve`
* **Purpose**: Executing RAG retrieval fetches relevant rules and files.
* **Request Body**:
  ```json
  { "query": "arborist requirements", "top_k": 3 }
  ```
* **Response**: List of matching text chunks from rule files.
