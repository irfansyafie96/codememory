# Error Dictionary & Stack Trace Diagnostic Guide

This dictionary catalogs common application and database exceptions, their actual underlying root causes, and standard remediation steps.

---

## 1. Database Exceptions

### `UniqueConstraintViolation` / `ORA-00001` / `23505`
* **Log Signature:**
  ```text
  ERROR: duplicate key value violates unique constraint "orders_order_number_key"
  DETAIL: Key (order_number)=(ORD-2026-001) already exists.
  ```
* **Root Cause:**
  Race condition during sequence generation or missing transaction isolation when generating sequential business numbers.
* **Remediation:**
  Inspect running number generator. Ensure atomic sequence increments (`UPDATE ... RETURNING` or database sequence `nextval`) rather than read-then-write logic.

---

### `QueryTimeoutException` / `LockNotAvailable`
* **Log Signature:**
  ```text
  org.postgresql.util.PSQLException: ERROR: canceling statement due to statement timeout
  ```
* **Root Cause:**
  Long-running transaction holding exclusive row locks or missing table index causing sequential scans on high-traffic tables.
* **Remediation:**
  1. Inspect `pg_stat_activity` or Oracle `v$session` for blocking sessions.
  2. Add missing compound index on filtered foreign keys.
  3. Ensure batch processing breaks updates into small chunked transactions.

---

## 2. Application & Runtime Exceptions

### `NullPointerException` / `TypeError: Cannot read properties of undefined`
* **Log Signature:**
  ```text
  java.lang.NullPointerException: Cannot invoke "...getRate()" because "discount" is null
  ```
* **Root Cause:**
  External integration or database query returned an optional/null entity that was dereferenced without a defensive null-check.
* **Remediation:**
  Add null-safe chaining (`Optional`, `?.`, or default fallbacks) at the service boundary before passing entities to internal calculation engines.

---

### `ConnectionPoolExhaustedException`
* **Log Signature:**
  ```text
  HikariPool-1 - Connection is not available, request timed out after 30000ms.
  ```
* **Root Cause:**
  Connection leak (unclosed DB connections), slow external HTTP calls executed inside an open transaction block, or undersized pool configuration.
* **Remediation:**
  Ensure all queries use `try-with-resources` or automated ORM session scopes. Never perform network I/O while holding an active database connection.
