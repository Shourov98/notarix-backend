const formatAdminRole = (role) =>
  String(role || "admin").replaceAll("_", " ").toUpperCase();

const buildAdminRows = (store) =>
  (store.admins || []).map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: formatAdminRole(admin.role)
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    status: admin.status || "Active",
    lastLogin: admin.lastSignInAt
      ? new Date(admin.lastSignInAt).toLocaleString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "Never",
  }));

const buildDashboardStats = ({ role, metrics }) => {
  if (role === "super_admin") {
    return [
      { label: "Total Users", value: String(metrics.totalUsers), change: "+9%", icon: "Users" },
      {
        label: "Pending Approvals",
        value: String(metrics.pendingApprovals),
        change: "+4%",
        icon: "ShieldAlert",
      },
      { label: "Total Orders", value: String(metrics.totalOrders), change: "+12%", icon: "FileText" },
      {
        label: "Completed Orders",
        value: String(metrics.completedOrders),
        change: "+8%",
        icon: "ShieldCheck",
      },
      {
        label: "Total Revenue",
        value: "$142k",
        change: "+15%",
        icon: "CircleDollarSign",
      },
      { label: "Admin Team", value: String(metrics.totalAdmins), change: "+1", icon: "UserCog" },
    ];
  }

  return [
    { label: "Total Orders", value: String(metrics.totalOrders), change: "+12%", icon: "FileText" },
    { label: "Active Orders", value: String(metrics.activeOrders), change: "+5%", icon: "ClipboardCheck" },
    { label: "Completed", value: String(metrics.completedOrders), change: "+8%", icon: "ShieldCheck" },
    {
      label: "Pending Orders",
      value: String(metrics.pendingOrders),
      change: "-2%",
      icon: "Gauge",
      tone: "danger",
    },
    { label: "Total Revenue", value: "$142k", change: "+15%", icon: "CircleDollarSign" },
    { label: "Total Notaries", value: String(metrics.totalNotaries), change: "+3%", icon: "Users" },
  ];
};

export const summarizeAdminConsole = (store, currentAdmin) => {
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
  const totalAdmins = store.admins.length;

  const resolvedAdmin = currentAdmin || store.admins[0] || null;
  const metrics = {
    totalUsers,
    activeClients,
    totalNotaries,
    pendingApprovals,
    totalOrders,
    activeOrders,
    completedOrders,
    pendingOrders,
    totalAdmins,
    totalDocuments: store.documents.length,
    pendingDocuments: store.documents.filter((item) => item.status === "Pending").length,
    verifiedDocuments: store.documents.filter((item) => item.status === "Verified").length,
    rejectedDocuments: store.documents.filter((item) => item.status === "Rejected").length,
  };

  return {
    currentAdmin: {
      id: resolvedAdmin?.id || "admin-user",
      name: resolvedAdmin?.name || "Admin User",
      role: formatAdminRole(resolvedAdmin?.role),
      avatar: resolvedAdmin?.avatar || "/profile.jpg",
    },
    dashboardStats: buildDashboardStats({
      role: resolvedAdmin?.role,
      metrics,
    }),
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
    adminRows: buildAdminRows(store),
    metrics,
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
