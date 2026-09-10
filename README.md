# Marketing Analytics E-Commerce Template

A full-featured e-commerce storefront with an admin panel and **AI-powered marketing intelligence**. Built with Next.js 14, Prisma, Stripe, and a Python FastAPI AI service powered by agentic orchestration.

---

## Features

- **Storefront** — Product listing with search/filter, product detail pages, shopping cart, Stripe checkout
- **Admin Panel** — Dashboard with stats, product CRUD, order management, marketing intelligence
- **AI Marketing Agents** — Automated SEO, content quality, product page, and content optimization analysis for every product
- **AI Orchestration Engine** — Job-queue-based multi-agent pipeline that runs analysis agents sequentially with per-step progress tracking
- **SEO-First Analysis** — Dedicated SEO agent using 9-dimension weighted scoring with evidence-backed findings, confidence labels, and impact/effort prioritization
- **AI Chat Assistant** — Role-based chat with intent classification, routing customers to storefront support and admins to a business intelligence agent
- **Competitor Analysis** — Web scraper + LLM agent that produces structured 9-section competitive reports with SWOT analysis
- **Business Auditor** — Forensic profit-leak detection across sales, inventory, refunds, and supplier operations
- **Quarterly Reports** — Auto-generated marketing performance reports with actionable suggestions
- **Authentication** — Admin login via NextAuth with credentials provider and JWT

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Payments | Stripe Checkout + Webhooks |
| Auth | NextAuth (credentials, JWT) |
| State | Zustand (cart, localStorage persistence) |
| AI Service | Python FastAPI, multi-provider LLM abstraction |
| LLM Providers | OpenAI, Anthropic (Claude), OpenCode, OpenRouter |

---

## AI Service Architecture

The Python AI service (`ai-service/`) is the intelligence layer of the application. It exposes a FastAPI server that handles product analysis, competitor analysis, chat, and report generation — all backed by a multi-provider LLM abstraction.

### LLM Client (`llm_client.py`)

A unified client that supports **four LLM providers** through environment configuration:

| Provider | Env Value | Default Model |
|----------|-----------|---------------|
| OpenAI | `openai` | `gpt-4o` |
| Anthropic (Claude) | `anthropic` | `claude-sonnet-4-20250514` |
| OpenCode | `opencode` | `big-pickle` |
| OpenRouter | `openrouter` | configurable |

The client supports both synchronous (`chat()`) and async (`chat_async()`) calls with temperature control and timeout handling. Agents can opt into a "complex" model tier via the `LLM_MODEL_COMPLEX` env var for deeper analysis tasks.

### AI Orchestration Engine

The orchestration system is the core of the analysis pipeline. It uses a **job-queue architecture** with a background worker thread to run agents sequentially without blocking the API.

**How it works:**

1. A frontend request triggers `POST /analyze/product` or `POST /analyze/competitor`
2. The API creates a `Job` with ordered steps and returns a `job_id` immediately
3. A background worker thread picks up the job and runs each step one-by-one
4. Each step calls a specific agent's `analyze()` method
5. Results stream back via `GET /analyze/status/{job_id}` with per-step progress

**Product Analysis Pipeline** — 4 agents run in sequence:
```
content → seo → product → optimization
```

**Competitor Analysis Pipeline** — 2 steps:
```
scrape → analyze
```

Each step reports `pending → running → completed/failed` status. Steps fail independently — a failed step doesn't block subsequent agents.

### Agent Base Classes (`agents/base.py`)

All analysis agents inherit from `BaseAgent`, which provides:

- Centralized LLM initialization and connection management
- Automatic retry logic with configurable `max_retries`
- JSON response parsing and validation
- Consistent `AnalysisResult` output schema (`score`, `findings`, `suggestions`)
- Fallback error results when LLM is unavailable

Chat agents inherit from `ChatAgent`, which adds:

- Async LLM calls via thread pool
- Role-based skill loading (admin vs storefront)
- Skills context injection into system prompts
- Retry logic for transient API failures

---

## AI Agents — Deep Dive

### 1. SEO Agent (`agents/seo.py`) ⭐

The most sophisticated agent in the system. Implements an **Agentic-SEO-Skill methodology** with evidence-backed findings and a rigorous 9-dimension weighted scoring model.

**Scoring Dimensions (weighted average, 0–100):**

| Dimension | Weight | What It Evaluates |
|-----------|--------|-------------------|
| Title Tag | 20% | Length (50-60 chars), keyword placement, brand inclusion, stop word avoidance |
| Meta Description | 15% | Length (150-160 chars), CTA presence, keyword inclusion, search intent alignment |
| URL Slug | 10% | Keyword usage, hyphens vs underscores, stop words, breadcrumb alignment |
| Heading Structure | 8% | Single H1, keyword alignment H1/title, H1→H2→H3 hierarchy, keyword-rich H2s |
| Image Optimization | 10% | Alt text on all images, keyword usage without stuffing, file naming |
| Schema Markup | 12% | Product schema completeness, organization schema, review snippet eligibility |
| Content Quality | 15% | Word count (300+), keyword density (1-3%), readability, uniqueness |
| Core Web Vitals | 5% | LCP, INP, CLS indicators, mobile responsiveness, HTTPS |
| Internal Links | 5% | Breadcrumbs, related products, category tree, anchor text |

**Evidence-backed analysis:**
- Every finding includes a **confidence label**: `Confirmed`, `Likely`, or `Hypothesis`
- Severity levels: `critical` (blocks indexing) → `low` (minor improvement)
- Every suggestion includes **impact** and **effort** ratings for prioritization
- Follows E-E-A-T guidelines (Experience, Expertise, Authoritativeness, Trustworthiness)
- Includes a Product schema JSON-LD template for implementation guidance

### 2. Content Quality Agent (`agents/content_quality.py`)

Evaluates product descriptions for **readability and persuasiveness**:

- **Readability & clarity** — sentence complexity, jargon, plain language
- **Grammar & spelling** — correctness and professional tone
- **Structure & formatting** — paragraph breaks, bullet points, hierarchy
- **Persuasiveness & engagement** — emotional hooks, benefits vs features, urgency

Output: 0-100 score with severity-tagged findings and improvement suggestions.

### 3. Product Page Agent (`agents/product_page.py`)

Analyzes **conversion optimization** across the full product page:

- **Description completeness** — does it answer all buyer questions?
- **Pricing presentation** — clear, competitive, no hidden costs
- **CTA effectiveness** — placement, wording, urgency signals
- **Social proof** — reviews, ratings, testimonials, trust signals
- **Image quality signals** — count, variety, zoom capability indicators

Output: 0-100 score with findings and suggestions for improving conversion rate.

### 4. Content Optimization Agent (`agents/content_optimization.py`)

A **rewriting agent** that takes existing product copy and produces keyword-optimized alternatives:

- **Keyword richness** — strategic placement without stuffing
- **Readability & clarity** — natural flow while being search-friendly
- **Search intent alignment** — matching what buyers actually search for
- **Conversion-focused writing** — action-oriented, benefit-first language

Uses the complex model tier for deeper analysis. Provides revised titles and descriptions ready to implement.

### 5. Quarterly Report Agent (`agents/quarterly_report.py`)

Aggregates results from the last 90 days of analysis into a **strategic summary report**:

- Overall score trends across all agents
- Most common issues found (with frequency counts)
- Top 3 priorities for the next quarter
- Action plan with effort estimates per suggestion

### 6. Business Auditor Agent (`agents/business_auditor.py`)

A **forensic profit-leak detector** that runs four specialized sub-analyzers on business data:

| Sub-Analyzer | Data Source | What It Finds |
|-------------|-------------|---------------|
| Sales Analyzer | Orders, campaigns | Revenue leakage from cancellations, low AOV, poor ad ROI |
| Inventory Analyzer | Products | Dead stock, capital tied up in inactive products, discount erosion |
| Refund Analyzer | Refunds, orders | Return rate patterns, refund-to-revenue ratio, top refund reasons |
| Supplier Analyzer | Suppliers, products | Low reliability, high lead times, margin erosion from cost multipliers |

Every finding includes an **estimated annualized dollar impact** so admins can prioritize by ROI.

**Health score:**
- ≥80 — Healthy, minor optimization opportunities
- ≥50 — Moderate leaks detected, actionable improvements available
- <50 — Significant profit leakage, immediate attention recommended

### 7. Competitor Analysis Agent (`agents/competitor_analysis.py`)

Combines **web scraping + LLM analysis** to produce a structured 9-section competitive report:

1. **Core Product** — catalog breadth, product types, categories
2. **Value Propositions** — positioning, USPs, trust signals
3. **Features** — capabilities, shipping, support, return policies
4. **Pricing** — strategy analysis (hardware vs software), tier comparisons
5. **Target Audience** — B2B/B2C signals, persona analysis
6. **Market Presence** — SEO signals, social proof, content marketing
7. **SWOT Grid** — strengths, weaknesses, opportunities, threats (each evidence-based)
8. **Why Choose Us** — concrete reasons based on data differences
9. **Objections** — honest assessment of where the competitor wins

**Scoring:**
- ≥80 — Strongly positioned vs competitor
- ≥50 — Competitive, actionable improvements available
- <50 — Vulnerable, significant strategic gaps

Produces both structured findings and a full **narrative markdown report** with executive summary, strategic recommendations, and SWOT matrix.

### 8. Storefront Chat Agent (`agents/chat.py`)

Answers customer questions using the product catalog as context:

- Auto-fetches active products from a **database-scoped view** (`active_products_v`)
- Scoped to store-only topics (products, orders, shipping, returns)
- Refuses out-of-scope questions with a polite redirect
- Injects product catalog (name, price, category) into the LLM context
- **Security**: Uses `AgentType.STOREFRONT` credentials — read-only access to the active products view

### 9. Admin Chat Agent (`agents/admin_chat.py`)

A **business intelligence assistant** for store admins that auto-fetches live data:

- Product summary (total, active, categories)
- Order funnel (count + revenue by status)
- Revenue trends and daily breakdowns
- Traffic sources (visits, orders, revenue per channel)
- Campaign performance (spend, impressions, clicks, conversions, ROAS)
- Search query data (impressions, clicks, avg position)
- SEO rankings (keyword, position, search volume)

**Security**: Uses `AgentType.ADMIN` credentials with read-only access. All customer-originated text is sanitized for prompt injection before entering the LLM context.

### 10. Supervisor Agent (`agents/supervisor.py`)

The **unified chat entry point** that classifies intent and routes to the correct sub-agent:

```
User message + role → SupervisorAgent
                          │
                    classify_intent()  (keyword-based, no LLM call)
                          │
            ┌─────────────┼─────────────┐
            │             │             │
      customer        admin        admin
      Storefront     AdminChat     analysis
      ChatAgent      Agent         agents
            │             │             │
            └─────────────┼─────────────┘
                          │
                     Response
```

**Intent classification** uses keyword matching (no LLM call for speed):

- Customer intents: `product_question`, `order_question`, `store_policy`, `greeting`
- Admin intents: `analytics_overview`, `product_analytics`, `order_analytics`, `traffic_analytics`, `campaign_analytics`, `seo_analytics`, `product_analysis`, `report_generation`, `greeting`

**Security**: Role-based routing is enforced at the **code level**, not the prompt level. A customer message can never invoke admin sub-agents, regardless of content.

### 11. Web Scraper (`scraper.py`)

A **competitor intelligence scraper** that extracts structured data from any website:

| Extractor | What It Pulls |
|-----------|---------------|
| Meta Tags | Title, description, OG tags, Twitter cards, JSON-LD schemas |
| Pricing | Dollar amounts with period detection (monthly/yearly/one-time) |
| Navigation | Category links, menu structure |
| Product Links | Discovers product pages via common URL patterns (/products/, /shop/, etc.) |
| Features | Bullet points, checkmark patterns, benefit statements |
| Social Proof | Review counts, ratings, testimonials, trust badges, case studies |
| CTAs | Primary buttons and action links |
| Headings | H1-H3 structure for content analysis |
| Images | Total count, alt text ratio |

Scrapes homepage + up to 5 product pages. Returns partial results on failure (never raises).

---

## API Routes

### Core E-Commerce

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth authentication |
| `/api/products` | GET/POST/PUT/DELETE | Product CRUD |
| `/api/checkout` | POST | Create Stripe checkout session |
| `/api/orders` | GET | List orders |
| `/api/webhooks/stripe` | POST | Stripe event webhook |

### AI Analysis

| Route | Method | Description |
|-------|--------|-------------|
| `/analyze/product` | POST | Enqueue product analysis (4 agents: content → seo → product → optimization) |
| `/analyze/competitor` | POST | Enqueue competitor analysis (scrape → analyze) |
| `/analyze/status/{job_id}` | GET | Poll job status with per-step progress |
| `/analyze/report` | POST | Generate quarterly report |
| `/analyze/audit` | POST | Run business audit (sales, inventory, refunds, suppliers) |
| `/health` | GET | Service health check |

### Chat

| Route | Method | Description |
|-------|--------|-------------|
| `/chat/{conversation_id}` | POST | HTTP chat endpoint |
| `/chat/{conversation_id}` | WebSocket | Real-time chat with streaming responses |

---

## Project Structure

```
├── src/
│   ├── app/                     # App Router pages & API routes
│   │   ├── (storefront)/        # Customer-facing pages (/, /products, /cart, /checkout, /contact, /about)
│   │   │   └── products/[slug]/ # Product detail page + AddToCartButton (loading/error boundaries per route)
│   │   ├── admin/               # Auth-protected dashboard (products, orders, competitors, audit, marketing, chat)
│   │   ├── auth/signin/         # NextAuth sign-in page
│   │   ├── api/                 # 15 route handlers (products, orders, checkout, webhooks, chat, analysis, audit, report, contact)
│   │   └── layout.tsx           # Root layout + metadata
│   ├── components/
│   │   ├── storefront/          # Header, Footer, ChatWidget, ProductCard, ProductGrid, ProductCarousel, CartItem, VantaBackground
│   │   ├── admin/               # Sidebar, StatsCard, ProductForm, AnalyzeButton, ChatWidget
│   │   └── ui/                  # Button, Toast
│   ├── lib/                     # Prisma client, Auth, Stripe, Dummy Products service
│   └── store/                   # Zustand cart store
├── prisma/
│   ├── schema.prisma            # Database models (User, Product, Order, AnalysisResult, etc.)
│   ├── seed.ts                  # Basic seed (sample products + admin user)
│   ├── seed-demo.ts             # Demo-data seed
│   └── seed-enhanced.ts         # Enhanced seed using the dummy products API
├── ai-service/
│   ├── main.py                  # FastAPI entry point (health, chat, analyze, report, audit)
│   ├── orchestrator.py          # Runs the product analysis agent pipeline
│   ├── llm_client.py            # Multi-provider LLM abstraction (OpenAI, Anthropic, OpenCode, OpenRouter)
│   ├── job_queue.py             # Thread-safe in-memory job queue with background worker
│   ├── scraper.py               # Web scraping for competitor intelligence
│   ├── db.py                    # Role-scoped database connection pools (storefront/admin)
│   ├── agents/                  # BaseAgent + analysis agents (seo, content, product, optimization,
│   │                            #   quarterly, auditor, competitor), chat agents, supervisor, sanitizer
│   ├── skills/                  # Role-scoped skill files (admin, storefront)
│   └── tests/                   # Pytest test suite
├── graphify-out/                # Generated knowledge graph (graph.html, GRAPH_REPORT.md, graph.json) — see below
├── docker-compose.yml           # Orchestrates PostgreSQL, AI service, Next.js
├── Dockerfile                   # AI service Docker image
├── Dockerfile.nextjs            # Next.js Docker image
└── next.config.js               # Next.js config (remote image patterns)
```

---

## Knowledge Graph

The repository ships a **pre-generated dependency knowledge graph** in `graphify-out/`, built with [graphify](https://github.com/safishamsi/graphify). It maps the entire codebase — 900+ nodes (code symbols, docs, concepts) and ~1,500 edges (imports, calls, references, inferred relationships) grouped into 87 communities.

Outputs:

| File | Description |
|------|-------------|
| `graph.html` | Interactive graph (open in any browser, no server needed) |
| `GRAPH_REPORT.md` | Audit report — god nodes, surprising connections, suggested questions |
| `graph.json` | Raw graph data (GraphRAG-ready) |
| `cost.json` / `manifest.json` | Token cost tracker and incremental-update manifest |

Query it during development instead of grepping:

```bash
# Ask a structural question about the codebase
graphify query "How does the chat pipeline work?"

# Shortest path between two concepts
graphify path "ChatContext" "Stripe Checkout"

# Rebuild after large refactors
graphify .
```

The `graphify-out/` directory is git-ignored; regenerate it anytime with `/graphify` (or the `graphify` CLI) against the repo root.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+ (for AI service)
- PostgreSQL 16 (or Docker)
- Stripe account (for payments)
- LLM API key (OpenAI, Anthropic, OpenCode, or OpenRouter)

### 1. Clone and install

```bash
git clone <repo-url>
cd Marketing-Analytics-Template
npm install
```

### 2. Start PostgreSQL

```bash
docker run -d --name pg \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 postgres:16
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for JWT encryption |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_...) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_...) |
| `AI_SERVICE_URL` | `http://localhost:8000` |
| `DUMMY_PRODUCTS_API_URL` | Optional: Dummy products API URL |

### 4. Set up the database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

Seeds an admin user (`admin@store.com` / `admin123`) and sample products.

### 5. Start the frontend

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Admin Dashboard Access

1. Navigate to **http://localhost:3000/admin**
2. If you're not signed in, you'll be redirected to **http://localhost:3000/auth/signin**
3. Log in with the seeded admin credentials:

| Field | Value |
|-------|-------|
| **Email** | `admin@store.com` |
| **Password** | `admin123` |

The admin dashboard includes:

| Area | Path |
|------|------|
| Overview / stats | `/admin` |
| Products | `/admin/products` |
| Orders | `/admin/orders` |
| Marketing Intelligence (AI analysis, quarterly reports) | `/admin/marketing` |
| Competitor Intelligence (web scraping + SWOT) | `/admin/competitors` |
| Business Auditor (profit-leak detection) | `/admin/audit` |
| Admin chat assistant | `/admin/chat` (also available as a bottom-right widget on every admin page) |

> ⚠️ **Change the default password after first login.** Anyone with the seeded credentials can access the dashboard since it's protected only by NextAuth sessions (no email verification).

### 6. Start the AI service

```bash
cd ai-service
cp .env.example .env
```

Edit `ai-service/.env`:

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `openai`, `anthropic`, `opencode`, or `openrouter` |
| `LLM_MODEL` | Model identifier (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `LLM_MODEL_COMPLEX` | Optional: heavier model for deep analysis tasks |
| `OPENAI_API_KEY` | Required if using OpenAI |
| `ANTHROPIC_API_KEY` | Required if using Anthropic |
| `OPENCODE_API_KEY` | Required if using OpenCode |
| `OPENROUTER_API_KEY` | Required if using OpenRouter |

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health`

---

## Docker Setup

```bash
docker compose up --build
```

Starts three containers:
- **PostgreSQL** (port 5432)
- **AI Service** (port 8000)
- **Next.js** (port 3000)

---

## Database Management

| Command | Description |
|---------|-------------|
| `npx prisma db push` | Push schema changes to the database |
| `npx prisma generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed sample data |
| `npm run db:seed:demo` | Seed with dummy products API data |
| `npx prisma studio` | Open Prisma Studio (GUI database browser) |

---

## Deployment

### Vercel (Frontend)

The storefront deploys to Vercel independently. See [Vercel Deployment](#-vercel-deployment-storefront-only) below.

### AI Service Platforms

The Python FastAPI service deploys to any platform supporting Python web services:

- **[Railway](https://railway.app)** — Docker-based, easy FastAPI deploys
- **[Render](https://render.com)** — Web service with Python support (free tier)
- **[Fly.io](https://fly.io)** — Docker-based, global edge deployment

---

## Vercel Deployment (Storefront Only)

### Prerequisites

1. Hosted PostgreSQL (Vercel Postgres, Neon, Supabase, or Railway)
2. Stripe account (or skip for browsing-only demo)
3. GitHub repository

### Steps

1. Push to GitHub
2. Import to [vercel.com/new](https://vercel.com/new)
3. Set environment variables (see table below)
4. Deploy
5. Run `npx prisma migrate deploy` against hosted DB
6. Seed with `npx prisma db seed`

### Environment Variables for Vercel

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://...?pgbouncer=true&connection_limit=1` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `AI_SERVICE_URL` | Your deployed AI service URL |

### What Works Without the AI Service

- ✅ Product browsing, search, cart, Stripe checkout
- ✅ Admin dashboard, product CRUD, order management
- ❌ AI chat widget (shows "unavailable")
- ❌ Product analysis, competitor analysis, reports, audits

---

## Stripe Webhook (Local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the signing secret (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## License

MIT
