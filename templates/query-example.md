# Example Queries

Verified, reusable diagnostic queries. Keep each one short: what it answers, when to use it, then the SQL with `<PLACEHOLDERS>`.

---

### 1. Find an order and its payment status
* **When to use:** a customer says they paid but the order still shows as pending.

```sql
SELECT o.id, o.status, p.gateway_ref, p.status AS payment_status
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.id = '<ORDER_ID>';
```

---

### 2. Orders stuck in processing for more than an hour
* **When to use:** background workers look stuck or a queue stopped draining.

```sql
SELECT id, status, updated_at
FROM orders
WHERE status = 'PROCESSING'
  AND updated_at < NOW() - INTERVAL '1 hour';
```
