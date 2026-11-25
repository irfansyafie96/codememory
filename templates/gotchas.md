# Architectural Gotchas, Traps & Lessons Learned

A living checklist of subtle engineering traps, production surprises, and architectural edge cases. Consult this before refactoring or designing new services.

---

## 1. Concurrency & Transaction Traps

* **The `@Transactional` + Synchronized Monitor Flaw:**
    * **Trap:** Adding Java `synchronized` (or an in-memory lock) to a method annotated with `@Transactional`.
    * **Why it fails:** Framework transaction interceptors commit the database transaction *after* the synchronized method exits and releases the lock. A second thread can enter the method and read uncommitted data before the previous transaction finishes writing to the database. In clustered deployments, local in-memory locks provide zero protection across separate server nodes.
    * **Rule:** Always enforce concurrency locks at the database level (`SELECT ... FOR UPDATE`, `UPDATE ... RETURNING`, or atomic increments).

* **Read-Then-Update Sequence Race Conditions:**
    * **Trap:** Selecting the current maximum sequence number (`SELECT MAX(no) ...`) and then executing a separate `INSERT` or `UPDATE` with `no + 1`.
    * **Why it fails:** High concurrent traffic will allow multiple requests to read the exact same number before either commits, resulting in duplicate key violations (`ORA-00001` / `23505 unique_violation`).
    * **Rule:** Use database sequences, atomic stored procedures, or `INSERT ... ON CONFLICT DO UPDATE`.

---

## 2. Git & Branching Hazards

* **Git 3-Way Merge Silent Overwrite:**
    * **Trap:** Merging long-lived feature branches directly into main/staging without rebasing.
    * **Why it fails:** If another developer renamed or deleted an interface while you added a reference to it in another file, Git's 3-way text merge will report zero conflicts, but the build will fail immediately upon compilation or runtime startup.
    * **Rule:** Always pull and rebase against the latest target branch before running tests and opening pull requests.

---

## 3. Timezone & DateTime Traps

* **Implicit Local Server Timezones:**
    * **Trap:** Storing timestamps without explicit UTC offsets (e.g., `TIMESTAMP WITHOUT TIME ZONE`).
    * **Why it fails:** Clustered instances or cloud servers in different availability zones might use UTC while local developer machines use local time, causing scheduled jobs to fire at unexpected hours or audit sorting to skew.
    * **Rule:** Always store UTC timestamps in databases (`TIMESTAMPTZ` / `ISO 8601`) and convert to local time only at the client display layer.

---

## 4. Caching & Stale Data Traps

* **Write-Behind Cache Desynchronization:**
    * **Trap:** Updating the database and assuming the cache will expire naturally via TTL.
    * **Why it fails:** Users refreshing the UI will see stale data for the remainder of the TTL window, leading to duplicate submissions or confusion.
    * **Rule:** Invalidate or update cache keys explicitly in the same service call that writes to the database.
