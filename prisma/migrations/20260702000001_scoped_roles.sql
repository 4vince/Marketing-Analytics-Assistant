-- Scoped database roles for agent-type-specific access control.
--
-- Run this migration against your PostgreSQL database to create
-- restricted roles that the AI service uses for each agent type.
-- The storefront role can only read public product data; the admin
-- role can read analytics data but nothing else.
--
-- Usage:
--   psql -d your_database -f prisma/migrations/20260702000001_scoped_roles.sql
--
-- Then set these env vars in the AI service:
--   DATABASE_URL_STOREFRONT=postgresql://storefront_user:<password>@localhost:5432/ecommerce
--   DATABASE_URL_ADMIN=postgresql://admin_user:<password>@localhost:5432/ecommerce

-- ── Storefront role ──────────────────────────────────────────────────────────
-- Purpose: Read access to public product data only. Used by StorefrontChatAgent
--          to look up products by name, category, or price range.
CREATE ROLE IF NOT EXISTS storefront_user WITH LOGIN PASSWORD 'storefront_dev_only' NOINHERIT;
GRANT CONNECT ON DATABASE ecommerce TO storefront_user;

-- Schema-level: can only see the schema
GRANT USAGE ON SCHEMA public TO storefront_user;

-- Product views: read-only, only active products, no internal fields
DROP VIEW IF EXISTS active_products_v;
CREATE VIEW active_products_v AS
SELECT id, name, slug, description, price, images, category
FROM products
WHERE status = 'active';

GRANT SELECT ON active_products_v TO storefront_user;

-- Allow listing categories (used for browsing)
GRANT SELECT (category) ON products TO storefront_user;

-- ── Admin role ───────────────────────────────────────────────────────────────
-- Purpose: Read-only access to all analytics tables. Used by AdminChatAgent
--          to answer admin questions about products, orders, revenue, etc.
--          Cannot INSERT, UPDATE, or DELETE any data.
CREATE ROLE IF NOT EXISTS admin_user WITH LOGIN PASSWORD 'admin_dev_only' NOINHERIT;
GRANT CONNECT ON DATABASE ecommerce TO admin_user;
GRANT USAGE ON SCHEMA public TO admin_user;

-- Read-only on all tables needed for analytics
GRANT SELECT ON ALL TABLES IN SCHEMA public TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO admin_user;

-- Explicitly revoke INSERT/UPDATE/DELETE for safety
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM admin_user;

-- ── Views for admin analytics (convenience, optional) ────────────────────────
-- These views provide pre-joined data that the admin agent can query directly.

DROP VIEW IF EXISTS admin_analytics_v;
CREATE VIEW admin_analytics_v AS
SELECT
    (SELECT COUNT(*) FROM products) AS total_products,
    (SELECT COUNT(*) FROM products WHERE status = 'active') AS active_products,
    (SELECT COUNT(*) FROM orders) AS total_orders,
    (SELECT COALESCE(SUM(total), 0) FROM orders) AS total_revenue,
    (SELECT COUNT(*) FROM orders WHERE status = 'paid') AS paid_orders,
    (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days') AS orders_last_30d;

GRANT SELECT ON admin_analytics_v TO admin_user;

-- ── Default privileges ───────────────────────────────────────────────────────
-- Ensure any new tables created in the future are also readable by admin_user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO admin_user;
