// Admin chat API — fetches comprehensive analytics from the database and sends it as
// context to the AI service so the admin assistant can answer business questions.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE = process.env.AI_SERVICE_URL || "http://localhost:8000";
const THIRTY_DAYS = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const SEVEN_DAYS = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const SIXTY_DAYS = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // ── Run all analytics queries in parallel ──────────────────────────────────
    const [
      productData,
      orderFunnel,
      ordersLast30,
      ordersLast7,
      recentOrders,
      productAnalytics,
      trafficSources,
      campaigns,
      searchQueries,
      latestRankings,
      analysisResults,
      reports,
    ] = await Promise.all([
      // Products: count + category breakdown
      (async () => {
        const [total, active, categories] = await Promise.all([
          prisma.product.count(),
          prisma.product.count({ where: { status: "active" } }),
          prisma.product.groupBy({
            by: ["category"],
            _count: true,
            _avg: { price: true },
          }),
        ]);
        return { total, active, categories: categories.map((c) => ({
          name: c.category,
          count: c._count,
          avgPrice: c._avg.price ? Math.round(c._avg.price / 100) : 0,
        }))};
      })(),

      // Order funnel: count + revenue by status
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
        _sum: { total: true },
      }),

      // Orders in last 30 days (for revenue trends)
      prisma.order.findMany({
        where: { createdAt: { gte: THIRTY_DAYS } },
        select: { total: true, createdAt: true, status: true },
      }),

      // Orders in last 7 days
      prisma.order.findMany({
        where: { createdAt: { gte: SEVEN_DAYS } },
        select: { total: true, status: true },
      }),

      // Recent orders (last 5)
      prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" } }),

      // Product analysis scores
      prisma.product.findMany({
        where: { status: "active" },
        include: {
          analysisResults: { orderBy: { createdAt: "desc" }, take: 4 },
        },
      }),

      // Traffic sources (last 30 days aggregated by source)
      prisma.trafficSource.groupBy({
        by: ["source"],
        _sum: { visits: true, orders: true, revenue: true },
        where: { date: { gte: THIRTY_DAYS } },
      }),

      // Campaigns (last 30 days, aggregated by campaign)
      prisma.campaign.groupBy({
        by: ["name", "channel"],
        _sum: { spend: true, impressions: true, clicks: true, conversions: true, revenue: true },
        where: { date: { gte: THIRTY_DAYS } },
      }),

      // Search queries (top 15 by impressions in last 30 days)
      prisma.searchQueryData.groupBy({
        by: ["query"],
        _sum: { impressions: true, clicks: true },
        _avg: { avgPosition: true },
        where: { date: { gte: THIRTY_DAYS } },
        orderBy: { _sum: { impressions: "desc" } },
        take: 15,
      }),

      // SEO rankings (latest position per keyword)
      prisma.$queryRawUnsafe<Array<{ keyword: string; page: string; position: number; search_volume: number | null }>>(`
        SELECT DISTINCT ON (keyword) keyword, page, position, search_volume
        FROM seo_rankings
        ORDER BY keyword, date DESC
      `),

      // Analysis results summary
      prisma.analysisResult.groupBy({
        by: ["agentType"],
        _avg: { score: true },
        _count: true,
      }),

      // Quarterly reports
      prisma.quarterlyReport.findMany({ take: 3, orderBy: { createdAt: "desc" } }),
    ]);

    // ── Compute derived analytics ──────────────────────────────────────────────
    const allOrders = await prisma.order.findMany({ select: { total: true } });
    const totalRevenue = allOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrderCount = allOrders.length;

    // Revenue trends: daily revenue for last 30 days
    const dailyRevenue: Record<string, number> = {};
    for (const o of ordersLast30) {
      if (o.status === "paid" || o.status === "pending") {
        const day = o.createdAt.toISOString().split("T")[0];
        dailyRevenue[day] = (dailyRevenue[day] || 0) + o.total;
      }
    }

    // Revenue trends: daily order counts for last 30 days
    const dailyOrders: Record<string, number> = {};
    for (const o of ordersLast30) {
      if (o.status === "paid" || o.status === "pending") {
        const day = o.createdAt.toISOString().split("T")[0];
        dailyOrders[day] = (dailyOrders[day] || 0) + 1;
      }
    }

    // Weekly revenue comparison (this week vs last week)
    const revenueLast7 = ordersLast7
      .filter((o) => o.status === "paid" || o.status === "pending")
      .reduce((sum, o) => sum + o.total, 0) / 100;

    // Product performance from order items (parse JSON to find top products)
    const productSales: Record<string, { name: string; revenue: number; quantity: number }> = {};
    for (const o of ordersLast30) {
      if (o.status === "paid") {
        const items = (o as any).items as Array<{ name: string; price: number; quantity: number }> | undefined;
        if (items) {
          for (const item of items) {
            if (!productSales[item.name]) {
              productSales[item.name] = { name: item.name, revenue: 0, quantity: 0 };
            }
            productSales[item.name].revenue += item.price * item.quantity;
            productSales[item.name].quantity += item.quantity;
          }
        }
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── Build the context catalog ──────────────────────────────────────────────
    const catalog: Record<string, unknown>[] = [
      {
        type: "product_performance",
        total_products: productData.total,
        active_products: productData.active,
        categories: productData.categories,
      },
      {
        type: "order_funnel",
        funnel: orderFunnel.map((f) => ({
          status: f.status,
          count: f._count,
          revenue: f._sum.total ? f._sum.total / 100 : 0,
        })),
      },
      {
        type: "revenue_trends",
        total_revenue: totalRevenue / 100,
        total_orders: totalOrderCount,
        revenue_last_7_days: revenueLast7,
        avg_order_value: totalOrderCount > 0 ? (totalRevenue / 100 / totalOrderCount).toFixed(2) : "0",
        daily_revenue: Object.entries(dailyRevenue).map(([date, rev]) => ({
          date,
          revenue: rev / 100,
        })),
        daily_orders: Object.entries(dailyOrders).map(([date, count]) => ({
          date,
          orders: count,
        })),
      },
      {
        type: "traffic_sources",
        sources: trafficSources.map((s) => ({
          source: s.source,
          visits: s._sum.visits ?? 0,
          orders: s._sum.orders ?? 0,
          revenue: s._sum.revenue ? (s._sum.revenue / 100).toFixed(2) : "0",
        })),
      },
    ];

    // Add campaign performance
    if (campaigns.length > 0) {
      catalog.push({
        type: "campaign_performance",
        campaigns: campaigns.map((c) => {
          const spend = c._sum.spend ?? 0;
          const revenue = c._sum.revenue ?? 0;
          return {
            name: c.name,
            channel: c.channel,
            spend: (spend / 100).toFixed(2),
            impressions: c._sum.impressions ?? 0,
            clicks: c._sum.clicks ?? 0,
            conversions: c._sum.conversions ?? 0,
            revenue: (revenue / 100).toFixed(2),
            roas: spend > 0 ? (revenue / spend).toFixed(2) : "0",
          };
        }),
      });
    }

    // Add search query data
    if (searchQueries.length > 0) {
      catalog.push({
        type: "search_query_data",
        queries: searchQueries.map((q) => ({
          query: q.query,
          impressions: q._sum.impressions ?? 0,
          clicks: q._sum.clicks ?? 0,
          avg_position: q._avg.avgPosition ? Math.round(q._avg.avgPosition * 10) / 10 : null,
        })),
      });
    }

    // Add SEO rankings
    if (Array.isArray(latestRankings) && latestRankings.length > 0) {
      catalog.push({
        type: "seo_rankings",
        keywords: (latestRankings as Array<{ keyword: string; page: string; position: number; search_volume: number | null }>).map((r) => ({
          keyword: r.keyword,
          page: r.page,
          position: r.position,
          search_volume: r.search_volume ?? 0,
        })),
      });
    }

    // Add top products from order data
    if (topProducts.length > 0) {
      catalog.push({
        type: "top_products",
        products: topProducts,
      });
    }

    // Add analysis scores
    if (analysisResults.length > 0) {
      catalog.push({
        type: "analysis_summary",
        average_scores: Object.fromEntries(
          analysisResults.map((r) => [r.agentType, {
            avg: Math.round(r._avg.score ?? 0),
            count: r._count,
          }])
        ),
      });
    }

    // Add recent reports
    if (reports.length > 0) {
      catalog.push({
        type: "recent_reports",
        reports: reports.map((r) => ({
          period: `${r.periodStart.toISOString().split("T")[0]} — ${r.periodEnd.toISOString().split("T")[0]}`,
          score: r.overallScore,
          summary: r.summary.slice(0, 100),
        })),
      });
    }

    // ── Send to unified AI service endpoint ─────────────────────────────────────
    const aiRes = await fetch(`${AI_SERVICE}/chat/${body.conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body.message, catalog, role: "admin" }),
      signal: AbortSignal.timeout(60000),
    });

    if (!aiRes.ok) throw new Error(`AI service returned ${aiRes.status}`);

    const data = await aiRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Admin chat error:", err);
    return NextResponse.json({
      message:
        "I'm sorry, the analytics assistant is currently unavailable. Please check back later or check the dashboard directly.",
    });
  }
}
