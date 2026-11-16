-- ============================================================================
-- TICKET #[NUMBER]: [SHORT DESCRIPTION OF FIX OR RECOVERY]
-- Environment      : [PROD / STG / DEV]
-- Target Identifier: [e.g. ORDER_ID / ACCOUNT_NO / TRANSACTION_REF]
-- Discrepancy      : [Expected vs Actual / Problem to Solve]
-- Author           : [Your Name / Team]
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: PRE-CHECK (Verify Target Rows Before Execution)
-- Run this query first to inspect current state and record primary keys.
-- ----------------------------------------------------------------------------
SELECT id, status, total_amount, updated_at
FROM example_orders
WHERE id IN ('ORD-100234', 'ORD-100235');
-- Expected: 2 rows returned with status = 'PENDING_PAYMENT'


-- ----------------------------------------------------------------------------
-- STEP 2: EXECUTE PATCH (Run Within Explicit Transaction Boundaries)
-- Only run when PRE-CHECK matches expected values and row counts.
-- ----------------------------------------------------------------------------
BEGIN;

-- 1. Update primary order record
UPDATE example_orders
SET status = 'PAID',
    payment_verified_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN ('ORD-100234', 'ORD-100235')
  AND status = 'PENDING_PAYMENT';
-- Expected: 2 rows updated

-- 2. Insert audit log / reconciliation trace
INSERT INTO example_audit_logs (order_id, action, note, created_at)
VALUES 
  ('ORD-100234', 'MANUAL_RECONCILE', 'Resolved via Ticket #[NUMBER]', CURRENT_TIMESTAMP),
  ('ORD-100235', 'MANUAL_RECONCILE', 'Resolved via Ticket #[NUMBER]', CURRENT_TIMESTAMP);
-- Expected: 2 rows inserted

COMMIT;


-- ----------------------------------------------------------------------------
-- STEP 3: POST-CHECK (Confirm Verification After Execution)
-- Run this immediately after COMMIT to confirm the final persisted state.
-- ----------------------------------------------------------------------------
SELECT id, status, payment_verified_at, updated_at
FROM example_orders
WHERE id IN ('ORD-100234', 'ORD-100235');
-- Expected: 2 rows returned with status = 'PAID' and payment_verified_at IS NOT NULL

SELECT order_id, action, note
FROM example_audit_logs
WHERE order_id IN ('ORD-100234', 'ORD-100235')
ORDER BY created_at DESC;
-- Expected: 2 rows returned with action = 'MANUAL_RECONCILE'
