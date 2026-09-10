-- Scoped database roles for agent-type-specific access control.
--
-- Idempotent — safe to re-run. Roles are created-or-altered so passwords
-- stay in sync; views are dropped + recreated; grants/reveokes apply cleanly.
--
-- Used by the AI service chat agents:
--   storefront_user -> read-only access to the active_products_v view
--   admin_user      -> read-only access to all analytics tables
--
-- The AI service also provisions this DDL automatically at startup
-- (ai-service/scoped_roles.py), so this migration is primarily for
-- environments that use `prisma migrate deploy`.

-- ── Roles (create or update password) ─────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'storefront_user') THEN
        CREATE ROLE storefront_user WITH LOGIN PASSWORD 'storefront_dev_only' NOINHERIT;
    ELSE
        ALTER ROLE storefront_user WITH LOGIN PASSWORD 'storefront_dev_only' NOINHERIT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin_user') THEN
        CREATE ROLE admin_user WITH LOGIN PASSWORD 'admin_dev_only' NOINHERIT;
    ELSE
        ALTER ROLE admin_user WITH LOGIN PASSWORD 'admin_dev_only' NOINHERIT;
    END IF;
END $$;

-- ── Connectivity (derived from the current database) ──────────────────────
DO $$
DECLARE dbname text;
BEGIN
    SELECT current_database() INTO dbname;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO storefront_user', dbname);
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO admin_user', dbname);
END $$;

GRANT USAGE ON SCHEMA public TO storefront_user;
GRANT USAGE ON SCHEMA public TO admin_user;

-- ── Public product view (storefront) ──────────────────────────────────────
DROP VIEW IF EXISTS active_products_v;
CREATE VIEW active_products_v AS
SELECT id, name, slug, description, price, images, category
FROM products
WHERE status = 'active';

GRANT SELECT ON active_products_v TO storefront_user;
GRANT SELECT (category) ON products TO storefront_user;

-- ── Analytics view (admin, convenience) ─────────────────────────────────
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

-- ── Admin read-only on all tables ─────────────────────────────────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO admin_user;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO admin_user;