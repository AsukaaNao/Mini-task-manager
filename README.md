# Mini Task Manager

A full-stack task management application featuring a **React + Tailwind CSS** frontend and a **Node.js + Express + TypeScript** backend with persistent **JSON file storage (`data.json`)**, strict linear status workflow enforcement, and immutable chronological audit logging.

---

## 1. Project Structure

The project is cleanly divided into dedicated `frontend/` and `backend/` directories, with minimal root orchestration:

```text
.
├── frontend/                     # Standalone React Application (React 19 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── api/tasks.ts          # Centralized API service with multi-user header injection
│   │   ├── components/           # UI Components (Navbar, TaskListPage, TaskDetailPage, TaskForm, etc.)
│   │   ├── types/task.ts         # Shared TypeScript models (Task, User, AuditLog)
│   │   ├── App.tsx               # Root component coordinating active user state & navigation
│   │   ├── main.tsx              # React DOM entrypoint
│   │   └── index.css             # Tailwind CSS imports
│   ├── index.html                # Frontend HTML entrypoint
│   ├── vite.config.ts            # Vite proxy & build configuration
│   ├── package.json              # Frontend dependencies and scripts
│   └── tsconfig.json             # Frontend TypeScript settings
│
├── backend/                      # Standalone Express + TypeScript API
│   ├── src/
│   │   └── server.ts             # Consolidated Express server, endpoints, JSON file engine & business rules
│   ├── data.json                 # Persistent database file (users, tasks, audit_logs)
│   ├── package.json              # Backend dependencies and scripts
│   └── tsconfig.json             # Backend TypeScript configuration
│
├── server.ts                     # Full-stack orchestrator running both API and frontend on port 3000
├── package.json                  # Root npm scripts (dev, build, lint)
├── tsconfig.json                 # Root TypeScript configuration
└── README.md                     # Project documentation
```

---

## 2. How to Run Frontend & Backend

### Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)

### Installation
From the root directory, install the dependencies:
```bash
npm install
```

---

### Running the Application

#### Option A: Full-Stack Mode (Backend + Frontend Together) — *Recommended*
Run the entire application with a single command from the project root:
```bash
npm run dev
```
- Starts on **`http://localhost:3000`** (or your assigned Cloud Run preview URL).
- The Express backend serves the REST API endpoints (`/tasks`, `/users`, etc.).
- The Vite React application is served concurrently on the same port.

#### Option B: Standalone Backend Only
To run only the Express REST API server:
```bash
npx tsx backend/src/server.ts
```
- Listens directly on **`http://localhost:3000`**.
- Reads and writes directly to `backend/data.json`.

#### Option C: Standalone Frontend Only
To run the React frontend independently with its own dev server:
```bash
cd frontend
npm install
npm run dev
```
- Starts the Vite dev server on **`http://localhost:5173`**.
- Uses Vite's reverse proxy (`frontend/vite.config.ts`) to forward API calls (`/tasks`, `/users`, `/api`) to the backend on `http://localhost:3000`.

---

## 3. How to Check If the Backend Works

Verify the backend endpoints directly using `curl` or in your browser:

### 1. List Users
```bash
curl http://localhost:3000/users
```
**Expected Output (`200 OK`)**:
```json
[
  { "id": "user-1", "name": "Alice", "email": "alice@example.com" },
  { "id": "user-2", "name": "Bob", "email": "bob@example.com" },
  { "id": "user-3", "name": "Charlie", "email": "charlie@example.com" },
  { "id": "anonymous", "name": "Anonymous", "email": "anonymous@example.com" }
]
```

### 2. List Active Tasks
```bash
curl http://localhost:3000/tasks
```
**Expected Output (`200 OK`)**: Returns an array of tasks loaded from `backend/data.json`.

### 3. Create a Task
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-1" \
  -d '{"title": "Review system architecture", "description": "Verify API contracts"}'
```

### 4. Advance Task Status & View Audit Log
```bash
# Advance status from to_do to pending
curl -X PUT http://localhost:3000/tasks/<TASK_ID>/status \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-2" \
  -d '{"status": "pending"}'

# Retrieve chronological audit history
curl http://localhost:3000/tasks/<TASK_ID>/audit-logs
```

---

## 4. Brief Architecture Explanation

1. **Frontend (`frontend/`)**:
   - Built with **React 19**, **TypeScript**, and **Tailwind CSS**.
   - Modular UI structure: Task List with filtering, Task Details with workflow advancement, and Task Creation/Editing modals.
   - Built-in **Active User Switcher** in the navigation bar to simulate multi-user collaboration seamlessly.
   - Outgoing HTTP requests automatically inject the `X-User-Id` header to attribute operations to the active user.

2. **Backend (`backend/`)**:
   - Built with **Express** and **TypeScript** adhering to RESTful conventions.
   - All backend routing, input validation, business logic, and JSON file handling are consolidated in `backend/src/server.ts` to maintain minimal complexity.
   - Strict status workflow progression: `to_do → pending → in_progress → done`.

3. **Data Persistence (`backend/data.json`)**:
   - Single JSON document storing three root entities: `users`, `tasks`, and `audit_logs`.
   - Thread-safe serialization: write operations are queued to prevent concurrent file corruption.
   - Atomic file updates: writes to a temporary file (`.tmp`) before renaming it to `data.json`.
   - Snapshot rollback: in-memory state is rolled back if file writing fails.

---

## 5. Assumptions Made

1. **Authentication & Multi-User Identity**:
   - No password authentication or JWT tokens were implemented as none were requested.
   - The user identity is established via an **Active User Switcher** in the UI and transmitted via the `X-User-Id` HTTP header (or request body), defaulting to `'anonymous'`.
2. **Linear Status Workflow**:
   - The status progression strictly follows: `to_do → pending → in_progress → done`.
   - Only single-step forward transitions are permitted. Skipping statuses (e.g., `to_do` to `in_progress`) or moving backwards (e.g., `in_progress` to `pending`) is rejected with HTTP `400 Bad Request`.
   - `done` is the terminal status; no further transitions are allowed.
3. **Task & User Ownership**:
   - Every task is associated with a `user_id` upon creation.
   - Task updates and status transitions preserve the original `user_id` association.
4. **Data Preservation on Deletion**:
   - Deleting a task or user executes a **soft-delete** (`deleted_at` timestamp recorded).
   - Soft-deleted entities are hidden from standard list endpoints but their historical data and audit log entries remain fully intact.
5. **Deployment Environment**:
   - Assumes a single-node server instance running Express where file system writes to `data.json` are local.

---

## 6. Trade-offs Made

| Trade-off | Chosen Approach | Alternative Considered | Rationale / Trade-off Impact |
|---|---|---|---|
| **Storage Engine** | File-based JSON (`data.json`) | Relational DB (PostgreSQL / SQLite) | Zero setup, human-readable data inspection, and lightweight execution, but does not support complex indexing or high-throughput concurrency. |
| **Backend File Structure** | Consolidated single-file (`backend/src/server.ts`) | Multi-layered Architecture (Controllers, Services, Repositories) | Follows the explicit requirement for a minimal folder structure without extra abstraction layers, though it reduces modular isolation for large teams. |
| **Write Strategy** | In-memory cache + serialized file writes | Reading & writing disk on every request | Fast read responses and guaranteed atomic state, but memory consumption is tied to database file size. |
| **User Context** | Client-selected header (`X-User-Id`) | Secure Session / JWT Auth | Instant multi-user switching and frictionless prototype testing, but lacks cryptographic verification. |

---

## 7. Potential Improvements (If Given More Time)

1. **Database Migration to a Relational Database**:
   - Migrate storage to PostgreSQL or Cloud SQL using Drizzle ORM or Prisma to achieve ACID transactions, foreign key constraints, connection pooling, and row-level locking.
2. **Authentication & Role-Based Access Control (RBAC)**:
   - Introduce secure user authentication (JWT/OAuth2) with password hashing (bcrypt/argon2).
   - Implement role permissions (e.g., Admin, Task Creator, Assignee) governing status updates.
3. **Real-time Collaboration**:
   - Integrate WebSockets or Server-Sent Events (SSE) so status transitions made by one user reflect instantly on all active screens.
4. **Pagination, Filtering, and Search**:
   - Implement database-level cursor or offset pagination, full-text title search, and filtering by date ranges.
5. **Automated End-to-End (E2E) Testing**:
   - Add Playwright test suites verifying full browser user journeys from login to task completion.

---

## 8. Architecture & Engineering Questions

### Q1: How do you ensure that audit logs cannot be modified?
1. **API-Level Immutability**:
   - The only exposed endpoint is `GET /tasks/:id/audit-logs`, which is strictly read-only.
2. **Server-Authoritative Generation**:
   - Audit entries cannot be created directly by client requests. They are generated internally by the server only when a valid, successful status transition occurs inside `PUT /tasks/:id/status`.
3. **Append-Only File Writing**:
   - The status change and the audit log append occur as a single atomic operation. If the audit log fails to record, the task status change is rolled back.
4. **Production Hardening (Future Recommendation)**:
   - In an enterprise production system, audit logs would be written to a dedicated append-only ledger, a database table with revoked `UPDATE` and `DELETE` grants, or an immutable Write-Once-Read-Many (WORM) storage service.

---

### Q2: Which part of this solution is the most risky if used by many concurrent users?
**The JSON file persistence layer (`backend/data.json`)**:
1. **File I/O Bottleneck**:
   - Every write operation (task creation, update, status change, deletion) requires serializing the entire database to JSON and writing it to disk. Under heavy write traffic from hundreds or thousands of concurrent users, this serialized file write queue creates a performance bottleneck.
2. **Multi-Instance / Horizontal Scaling Issue**:
   - If the application scales to multiple server instances or containers behind a load balancer, each instance would read and write to its own local disk. This results in split-brain data conflicts and out-of-sync state.
3. **Memory Footprint**:
   - The entire dataset resides in process memory. As the volume of tasks and audit records grows, server RAM usage increases proportionally.

---

### Q3: If this task grows into a large system, which part would you refactor first and why?
**Refactor the Persistence Layer from JSON files to a Relational Database (PostgreSQL)**:
1. **Why First**:
   - Data integrity, concurrency, and reliability are the foundation of any growing system. A relational database solves file locking issues, provides true ACID transactions, and supports row-level locking for concurrent status updates on different tasks.
2. **Decoupling Business Logic**:
   - Simultaneously refactor the single `server.ts` file into a clean **Domain-Driven or Layered Architecture**:
     - **Repositories**: Encapsulate SQL queries and data access.
     - **Services**: House business rules (status workflow validation engine, audit log creation).
     - **Controllers / Routers**: Handle HTTP request validation and status responses.
   - This enables independent testing of workflow logic without requiring disk or network mocking.

---

### Q4: If you used AI, explain which parts were assisted by AI and how you validated them.
1. **Assisted Areas**:
   - **Boilerplate & Endpoint Implementation**: Scaffolding Express route handlers, input validation logic, and TypeScript interface contracts.
   - **Architecture & Documentation Drafting**: Structuring clear API contracts and comprehensive English documentation according to technical requirements.
2. **Validation Methodology**:
   - **Compiler & Linter Validation**: Ran `npm run lint` (`tsc --noEmit -p frontend && tsc --noEmit -p backend`) and Vite compilation to verify strict TypeScript adherence with zero type errors.
   - **Live HTTP Execution**: Tested live endpoints using `curl` against the running server on port 3000 to verify status codes, payload structures, and JSON file updates on disk.
   - **Manual UI Interaction**: Tested user switching, creating tasks, editing details, and progressing statuses in the live browser preview to ensure frontend-backend integration was seamless.