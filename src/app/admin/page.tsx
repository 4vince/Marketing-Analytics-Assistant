// Admin dashboard — shows stats (product count, order count, revenue) and recent orders table.
import { prisma } from "@/lib/prisma";
import StatsCard from "@/components/admin/StatsCard";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-brand-yolk/10 text-brand-yolk border-brand-yolk/20",
    cancelled: "bg-brand-fence/30 text-brand-muted border-brand-fence",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || colors.cancelled}`}>
      {status}
    </span>
  );
}

export default async function AdminDashboard() {
  const [productCount, orderCount, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);

  const revenue = recentOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-semibold text-brand-warm-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-brand-muted mt-1.5">Store overview and recent activity</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatsCard title="Products" value={productCount} />
        <StatsCard title="Orders" value={orderCount} />
        <StatsCard title="Revenue" value={`$${revenue > 0 ? (revenue / 100).toLocaleString() : "0.00"}`} />
      </div>

      {/* Recent Orders */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-semibold text-brand-warm-white">Recent Orders</h2>
          {orderCount > 5 && (
            <a href="/admin/orders" className="text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors">
              View all &rarr;
            </a>
          )}
        </div>

        <div className="overflow-x-auto bg-brand-clay border border-brand-fence rounded-xl">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-brand-fence">
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Order</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Customer</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Total</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="group border-b border-brand-fence/60 last:border-b-0 transition-colors hover:bg-brand-risen/40"
                >
                  <td className="p-4 font-mono text-sm text-brand-muted">{order.id.slice(0, 8)}</td>
                  <td className="p-4 text-sm text-brand-warm-white">{order.customerName}</td>
                  <td className="p-4 font-mono text-sm tabular-nums text-brand-warm-white">
                    ${(order.total / 100).toFixed(2)}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <p className="text-3xl font-display text-brand-fence mb-3">✦</p>
                    <p className="text-brand-warm-white text-sm font-medium">No orders yet</p>
                    <p className="text-xs text-brand-muted mt-1">Orders will appear here once customers start purchasing.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
