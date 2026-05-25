export const summarizeAdminConsole = (store) => {
  const totalUsers = store.users.length;
  const totalNotaries = store.users.filter((item) => item.role === "Notary").length;
  const activeClients = store.users.filter(
    (item) => item.role === "Client" && item.status === "Active"
  ).length;
  const pendingApprovals = store.users.filter(
    (item) => item.status === "Pending" || item.verification === "Pending"
  ).length;

  const totalOrders = store.orders.length;
  const activeOrders = store.orders.filter((item) =>
    ["Assigned", "In Progress"].includes(item.status)
  ).length;
  const completedOrders = store.orders.filter(
    (item) => item.status === "Completed"
  ).length;
  const pendingOrders = store.orders.filter((item) => item.status === "Pending").length;

  return {
    currentAdmin: {
      name: store.admins[0]?.name || "Admin User",
      role: String(store.admins[0]?.role || "admin").replaceAll("_", " ").toUpperCase(),
      avatar: store.admins[0]?.avatar || "/profile.jpg",
    },
    dashboardStats: [
      { label: "Total Orders", value: String(totalOrders), change: "+12%", icon: "FileText" },
      { label: "Active Orders", value: String(activeOrders), change: "+5%", icon: "ClipboardCheck" },
      { label: "Completed", value: String(completedOrders), change: "+8%", icon: "ShieldCheck" },
      { label: "Pending Orders", value: String(pendingOrders), change: "-2%", icon: "Gauge", tone: "danger" },
      { label: "Total Revenue", value: "$142k", change: "+15%", icon: "CircleDollarSign" },
      { label: "Total Notaries", value: String(totalNotaries), change: "+3%", icon: "Users" },
    ],
    recentOrders: store.orders.slice(0, 3).map((order) => ({
      id: `#${order.id}`,
      client: order.client,
      notary: order.notary,
      service: order.type,
      status: order.status.toLowerCase(),
      date: "Apr 24, 2026",
    })),
    users: store.users,
    orders: store.orders.map((item) => ({
      ...item,
      id: `#${item.id}`,
    })),
    notaries: store.notaries,
    documents: store.documents.map((item) => ({
      ...item,
      orderId: `#${item.orderId}`,
      uploadedBy: item.uploadedByLabel,
    })),
    payments: store.payments,
    messages: store.messages,
    supportTickets: store.supportTickets,
    adminRows: store.adminRows,
    metrics: {
      totalUsers,
      activeClients,
      totalNotaries,
      pendingApprovals,
      totalOrders,
      activeOrders,
      completedOrders,
      pendingOrders,
      totalDocuments: store.documents.length,
      pendingDocuments: store.documents.filter((item) => item.status === "Pending").length,
      verifiedDocuments: store.documents.filter((item) => item.status === "Verified").length,
      rejectedDocuments: store.documents.filter((item) => item.status === "Rejected").length,
    },
    reportSummary: {
      totalOrders,
      totalRevenue: 42900,
      notaryPayouts: 28450,
      netProfit: 14450,
      totalClients: store.users.filter((item) => item.role === "Client").length,
      topNotaries: ["Elena Rodriguez", "Marcus Chen", "Sarah Jenkins"],
      activityRows: store.orders.slice(0, 4).map((order, index) => ({
        id: `#${order.id}`,
        client: [order.client, "Jennifer Wu", "Real Estate Pros", "Smith Family Trust"][index] || order.client,
        notary: [order.notary, "Marcus C.", "Sarah J.", "Elena R."][index] || order.notary,
        revenue: "$150.00",
        payout: "$105.00",
        profit: "$45.00",
        status: index === 2 ? "Pending" : "Signed",
      })),
    },
  };
};
