# Call Compass — Backend API

Production Express & TypeScript REST API service for the Call Compass cold-call companion platform. Connects to Supabase (PostgreSQL) for persistence and Groq LLM (`llama-3.3-70b-versatile`) for structured call post-processing and AI summaries.

## 🏛️ Architecture & Reliability Highlights

1. **Monotonic Stage Progression**:
   - Enforced at the PostgreSQL level via `reach_stage` stored procedure using `greatest(last_stage_reached, p_stage)`. Concurrent or out-of-order requests can never regress a caller's stage backwards.
2. **Deterministic Groq AI Summarization**:
   - Structured JSON mode (`response_format: { type: "json_object" }`) backed by strict runtime Zod schema validation.
   - Guardrails against prompt injection and automatic retry on malformed JSON with quote-accuracy validation.
3. **Resilient Rate Limiting & Security**:
   - CORS protected by `FRONTEND_ORIGIN` allowlist.
   - IP-based rate limiting (100 req/min general, 10 req/min on `/summary`).
   - Row-Level Security (RLS) enabled on all tables; backend communicates using service-role key.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express + TypeScript
- **Validation:** Zod schemas on all incoming payloads and LLM responses
- **Database:** Supabase (PostgreSQL)
- **AI Engine:** Groq API (`llama-3.3-70b-versatile`) via native `fetch`
- **Testing:** Vitest (72 automated unit & integration tests)

---

## 📋 Database Setup (Supabase)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**.
3. Paste the contents of `supabase/schema.sql` and click **Run**.
4. Both `calls` and `stage_results` tables will be created with RLS enabled and the `reach_stage()` function created.
5. In **Project Settings → API**, copy:
   - **Project URL** ➔ `SUPABASE_URL`
   - **Service role / secret key** ➔ `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Populate `.env` with your Supabase and Groq keys:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
FRONTEND_ORIGIN=http://localhost:5173
PORT=3000
```

### 3. Run Development Server
```bash
npm run dev
```
Health check:
```bash
curl http://localhost:3000/api/health
```

### 4. Run Test Suite
```bash
npm test
```
*(All 72 tests run against mocked clients without requiring live API keys)*

---

## ☁️ Deployment to Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect this repository (`sales_managment_ai_backend`).
3. Set the following configuration:
   - **Environment:** `Node`
   - **Node Version:** `20`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Add the Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`
   - `GROQ_MODEL`: `llama-3.3-70b-versatile`
   - `FRONTEND_ORIGIN`: Your deployed Vercel URL (e.g. `https://sales-repserntative-ai.vercel.app` without trailing slash)
5. Deploy Web Service!
