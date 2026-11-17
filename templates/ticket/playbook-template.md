# Playbook: [Playbook Name / Standard Operating Procedure]

> **Trigger / Symptom:** [Brief description of when to use this playbook, e.g., "Worker queue deadlock", "Stale transaction status", "Duplicate invoice number generated"]

---

### Prerequisites & Permissions
* **Target Environment:** [PROD / STG / DEV]
* **Required Tools:** [DB Client / Terminal / Kubernetes CLI]
* **Key Schemas / Tables:** `[TABLE_A]`, `[TABLE_B]`

---

### Step-by-Step Procedure

#### 1. Identify the Affected Records
Run diagnostic query to verify scope and isolate primary keys:
```sql
SELECT id, status, updated_at 
FROM example_orders 
WHERE status = 'PROCESSING' 
  AND updated_at < NOW() - INTERVAL '1 hour';
```

#### 2. Verify Root Cause & Blockers
Check worker logs or dependent lock tables:

* Inspect server application logs for thread timeouts:
    * `grep -i "lock wait timeout" application.log`
* Verify foreign key or transaction states.

#### 3. Execute Resolution
Apply corrective action (either via script, SQL patch, or admin endpoint):
```sql
-- Always execute inside an explicit transaction
BEGIN;

UPDATE example_orders 
SET status = 'FAILED', 
    error_message = 'Timed out during payment processing'
WHERE id = :order_id 
  AND status = 'PROCESSING'; -- Guard condition

COMMIT;
```

#### 4. Post-Verification & Notification
* [ ] Verify that order status transitioned to `FAILED`.
* [ ] Confirm customer retry mechanism was unblocked.
* [ ] Notify customer support / operations channel.

---

### Known Pitfalls & Gotchas
* **Never batch update without filtering by status:** Always include `status = 'PROCESSING'` in the `WHERE` clause to avoid overwriting orders that finished concurrently.
* **Cache Invalidation:** Remember to flush Redis key `orders:cache:[order_id]` after manual database adjustments.
