// Admin orders list — table of all orders with ID, customer, total, status, and date.
import { prisma } from "@/lib/prisma";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-brand-warm-white mb-8">Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-brand-clay border border-brand-fence rounded-xl p-12 text-center">
          <p className="text-3xl font-display text-brand-fence mb-3">✦</p>
          <p className="text-brand-warm-white text-sm font-medium">No orders yet</p>
          <p className="text-xs text-brand-muted mt-1">Orders will appear here once customers start purchasing.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-brand-clay border border-brand-fence rounded-xl">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-brand-fence">
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Order ID</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Customer</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Email</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Total</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Status</th>
                <th className="text-left p-4 text-[11px] font-medium text-brand-muted uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="group border-b border-brand-fence/60 last:border-b-0 transition-colors hover:bg-brand-risen/40">
                  <td className="p-4 font-mono text-sm text-brand-muted">{order.id.slice(0, 8)}</td>
                  <td className="p-4 text-sm text-brand-warm-white">{order.customerName}</td>
                  <td className="p-4 text-sm text-brand-muted">{order.customerEmail}</td>
                  <td className="p-4 font-mono text-sm tabular-nums text-brand-warm-white">${(order.total / 100).toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-brand-yolk/10 text-brand-yolk border border-brand-yolk/20"
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-brand-muted tabular-nums">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
