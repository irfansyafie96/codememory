# Runbook: Local Development Setup & Workflows

This runbook outlines how to bootstrap the local development environment, execute automated test suites, and troubleshoot container dependencies.

---

### Prerequisites
* **Runtime:** Node.js `>= 20.x` or Python `>= 3.11`
* **Container Engine:** Docker & Docker Compose
* **Package Manager:** `pnpm` / `npm` / `poetry`

---

### 1. Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/your-repo.git
   cd your-repo
   ```

2. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to verify local port assignments and database credentials.*

3. **Install dependencies:**
   ```bash
   npm install
   ```

---

### 2. Launch Local Dependencies

Start PostgreSQL, Redis, and local mock services via Docker Compose:
```bash
docker compose up -d
```

Verify services are healthy:
```bash
docker compose ps
```

---

### 3. Database Migrations & Seeds

Apply latest database schema migrations and load development seed data:
```bash
npm run db:migrate
npm run db:seed
```

---

### 4. Running the Application

Start the local development server with hot-reload:
```bash
npm run dev
```
The server will bind to `http://localhost:3000`.

---

### 5. Running Automated Tests

* **Unit Tests:**
  ```bash
  npm run test:unit
  ```
* **Integration Tests (requires local DB):**
  ```bash
  npm run test:integration
  ```
* **End-to-End Tests:**
  ```bash
  npm run test:e2e
  ```

---

### 6. Common Troubleshooting

* **Port Conflict (`EADDRINUSE: 5432`):**
    * Check if a native PostgreSQL service is running locally:
      ```bash
      # On macOS/Linux
      lsof -i :5432
      # On Windows
      netstat -ano | findstr 5432
      ```
* **Stale Docker Volume:**
    * If database migrations fail due to conflicting legacy schemas, reset the volume:
      ```bash
      docker compose down -v && docker compose up -d
      ```
