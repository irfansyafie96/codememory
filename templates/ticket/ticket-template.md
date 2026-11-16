# 001 - Example Bug Fix or Incident
**Environment:** PROD | **Branch:** `fix/null-pointer-order-calc`

### 1. What was the issue?
When customers checked out with a zero-dollar coupon, the order calculation service crashed with a `NullPointerException` on `discount.getRate()`. The checkout screen displayed an unhelpful generic error dialog: *"Internal Server Error"*.

### 2. How did I fix it?
Added a null-safe guard in `OrderCalculationService.java` to default discount rate to zero if rate is null. Wrapped the discount application in a safe fallback handler.

* **Files changed:**
    * `OrderCalculationService.java`
    * `CouponValidator.java`
* **Patch / Migration:** None (code fix only).

### 3. What did I realize?
* **Always validate third-party coupon objects:** The coupon microservice returns an empty rate object instead of a zero float for 100% off promos.
* **Cluster deployment check:** When deploying to clustered nodes, check that all worker instances pick up the new container build before resolving the ticket.
