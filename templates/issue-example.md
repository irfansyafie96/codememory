# 1 - Example: Duplicate invoice numbers under heavy traffic
**Type:** Bug | **Env/Status:** PROD | **Branch:** `fix/issue-1-duplicate-invoice`

### 1. What was the issue?
Two customers checking out at the same moment received the same invoice number. The number was generated with a "read the highest value, then add 1" query, so both requests read the same value before either one saved.

### 2. How did I fix it?
Replaced the read-then-write logic with a database sequence, so every request gets a unique value atomically. Existing duplicates were corrected with a verified patch.

* **Files changed:**
    * `InvoiceService.java`
    * `InvoiceRepository.java`
* **SQL Patch:** [`patches/1_patch.sql`](../patches/1_patch.sql)

### 3. What did I realize?
* **Read-then-write is not atomic:** any "max + 1" number generator breaks under concurrency; use a sequence or a unique constraint.
* **Check for existing duplicates first:** the unique constraint could only be added after the old duplicates were cleaned up.
