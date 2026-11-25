# System Architecture & Component Map

This document outlines the high-level architecture, module boundaries, external integrations, and core data flow paths.

---

## 1. High-Level Component Topology

```mermaid
graph TD
    Client["Web / Mobile Clients"]
    CDN["Cloudflare CDN & Edge Cache"]
    Gateway["API Gateway / Reverse Proxy"]
    App["Core Application Service"]
    Worker["Background Queue Worker"]
    DB[("Primary Database (PostgreSQL)")]
    Cache[("Redis In-Memory Cache")]
    S3[("Object Storage (S3 / R2)")]
    Stripe["Payment Gateway (Stripe)"]

    Client --> CDN
    CDN --> Gateway
    Gateway --> App
    App --> DB
    App --> Cache
    App --> Worker
    Worker --> DB
    Worker --> S3
    App --> Stripe
```

---

## 2. Layer Responsibilities

| Layer | Technology | Primary Responsibilities |
| :--- | :--- | :--- |
| **Edge & Routing** | Cloudflare / Nginx | SSL termination, DDoS protection, static asset caching |
| **API Gateway** | Express / Hono / FastAPI | Rate limiting, JWT verification, request validation |
| **Core Service** | Application Code | Domain business logic, transaction coordination |
| **Worker Queue** | BullMQ / Celery | Asynchronous jobs, email dispatches, PDF generation |
| **Persistence** | PostgreSQL 16 | Relational data, ACID transactions, audit logs |
| **In-Memory** | Redis | Session state, rate limiter counters, transient caches |

---

## 3. Core Data Flow: Order Placement & Settlement

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant App as API Service
    participant DB as PostgreSQL
    participant Worker as Background Worker
    participant Gate as Payment Gateway

    Customer->>App: POST /orders/checkout
    App->>DB: Insert Order (Status: PENDING)
    App->>Gate: Create Payment Intent
    Gate-->>App: Return Client Secret
    App-->>Customer: Await Payment
    Customer->>Gate: Authorize Payment
    Gate-->>App: Webhook: charge.succeeded
    App->>DB: UPDATE Order (Status: PAID)
    App->>Worker: Enqueue Notification Job
    Worker->>Customer: Send Email Receipt
```

---

## 4. Architectural Invariants
* **Zero Synchronous External Calls in DB Transactions:** Never perform third-party HTTP requests (e.g. Stripe, SendGrid) inside an open database transaction block. Always commit or stage via outbox pattern first.
* **Idempotent Webhooks:** All webhook endpoints must record incoming event IDs in an `idempotency_keys` table to prevent duplicate processing during network retries.
