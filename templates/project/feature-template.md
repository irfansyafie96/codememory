# FEAT-001 - User Authentication & Session Management
**Status:** Completed | **Target Version:** `v1.2.0` | **Branch:** `feature/auth-sessions`

---

### 1. What was the goal?
Implement secure user session authentication supporting both JWT for stateless API clients and HttpOnly cookies for web frontend navigation. The system needed multi-factor authentication (MFA) fallback and automatic token refresh to prevent session interruption during checkout workflows.

---

### 2. How did we build it?
Implemented token issuance using asymmetric RS256 keypairs. Integrated Redis session caching with a sliding expiration TTL of 7 days. Added an authentication middleware to validate Bearer tokens and verify session revocation in Redis.

* **Key Files changed:**
    * `AuthController.ts`
    * `SessionService.ts`
    * `TokenVerificationMiddleware.ts`
    * `AuthValidationSchemas.ts`

* **Architecture Flow:**
    ```mermaid
    sequenceDiagram
        autonumber
        actor User as Client App
        participant API as API Gateway
        participant Auth as SessionService
        participant DB as PostgreSQL
        participant Cache as Redis

        User->>API: POST /api/v1/auth/login
        API->>Auth: Validate Credentials
        Auth->>DB: Query User & Password Hash
        DB-->>Auth: User Record
        Auth->>Cache: Set Session (TTL: 7d)
        Cache-->>Auth: OK
        Auth-->>User: Return Access Token + HttpOnly Cookie
    ```

---

### 3. What did we realize & trade-offs?
* **RS256 vs HS256:** Decided on RS256 asymmetric keys so downstream microservices can verify tokens locally using public keys without pinging the central auth server.
* **Clock Skew Tolerance:** Added a 30-second leeway in JWT token expiration validation to prevent spurious 401 errors caused by distributed server clock drifts.
* **Redis Failover Safety:** If Redis is temporarily down, the middleware falls back to stateless token validation rather than terminating active user sessions.
