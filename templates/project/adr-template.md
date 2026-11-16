# ADR-001: Selection of Primary Database Engine

* **Status:** Accepted
* **Date:** 2026-11-16
* **Deciders:** Engineering Team, Tech Lead
* **Consulted:** DevOps, Security

---

## Context and Problem Statement
Our application requires a reliable persistence layer handling structured relational entities (users, financial transactions, audit logs) while providing high-performance JSON document storage for dynamic user metadata. We anticipate moderate read/write traffic scaling to 5,000 requests/sec within 18 months.

---

## Decision Drivers
* Strict ACID compliance and foreign key integrity for billing transactions.
* Native support for indexing JSON documents (JSONB).
* Mature ecosystem, cloud-managed hosting (AWS RDS, Supabase, Cloud SQL), and zero vendor lock-in.
* Developer familiarity and migration tooling.

---

## Considered Options
1. **PostgreSQL 16** (Relational with JSONB)
2. **MongoDB 7.0** (Document Database)
3. **MySQL 8.0** (Relational)

---

## Decision Outcome
**Chosen Option:** **PostgreSQL 16**

We chose PostgreSQL because it provides full transactional ACID guarantees for financial entities while offering JSONB indexing with GIN indexes for dynamic metadata. This eliminates the operational overhead of running two separate databases (relational + document) in the early stages.

### Positive Consequences
* Single database cluster to monitor, backup, and maintain.
* Strong relational constraints prevent orphan financial records.
* Flexible JSONB querying enables fast iteration on user profile schemas.

### Negative Consequences / Trade-offs
* Schema migrations must be strictly managed via migration scripts to prevent table locks during deployments.
* Scaling writes beyond a single primary instance will require read replicas and connection pooling (PgBouncer).

---

## Pros and Cons of the Options

### PostgreSQL 16
* Good, because: Native JSONB with indexing, strict transactional boundaries, excellent extension ecosystem (`pg_trgm`, `pgcrypto`).
* Bad, because: Vertical write scaling limit; requires connection pooling for high concurrency.

### MongoDB 7.0
* Good, because: Native horizontal sharding and flexible schemaless documents.
* Bad, because: Multi-document transactions carry higher latency overhead and weaker schema guarantees for financial audits.

### MySQL 8.0
* Good, because: High write throughput and widespread familiarity.
* Bad, because: JSON querying and indexing are less mature compared to PostgreSQL JSONB.
