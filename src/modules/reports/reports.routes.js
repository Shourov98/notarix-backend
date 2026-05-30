import { Router } from "express";
import { z } from "zod";
import { requireAdminAuth } from "../../shared/http/auth-middleware.js";
import { validate } from "../../shared/middleware/validate.js";
import { OrderModel } from "../orders/order.model.js";
import { PaymentModel } from "../payments/payment.model.js";
import { ensurePaymentsForOrders } from "../payments/payment.service.js";
import { UserModel } from "../users/user.model.js";
import { ok } from "../../shared/http/respond.js";

export const reportsRouter = Router();

const baseReportSchema = z.object({
  body: z.object({}).passthrough(),
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.string().optional(),
    direction: z.enum(["Inbound", "Outbound"]).optional(),
    search: z.string().optional(),
    format: z.enum(["json", "csv"]).optional(),
  }).passthrough(),
  params: z.object({}).passthrough(),
});

const REPORT_TIMEZONE = "UTC";

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const date = new Date(String(value).includes("T") ? value : `${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const matchesDateRange = (value, dateFrom, dateTo) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
};

const buildDateRange = (query) => ({
  dateFrom: parseDate(query.dateFrom, false),
  dateTo: parseDate(query.dateTo, true),
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: REPORT_TIMEZONE,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: REPORT_TIMEZONE,
});

const currency = (value) => Number(value || 0).toFixed(2);

const toCsv = (rows) => {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const stringValue = value == null ? "" : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replaceAll("\"", "\"\"")}"`;
    }
    return stringValue;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
};

const sendCsv = (res, filename, rows) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.status(200).send(toCsv(rows));
};

const buildMonthlySeries = (items, amountAccessor, dateAccessor) => {
  const buckets = new Map();

  items.forEach((item) => {
    const rawDate = dateAccessor(item);
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const label = monthFormatter.format(date).toUpperCase();
    buckets.set(key, {
      key,
      label,
      value: Number((buckets.get(key)?.value || 0) + Number(amountAccessor(item) || 0)),
    });
  });

  return Array.from(buckets.values()).sort((left, right) =>
    left.key.localeCompare(right.key)
  );
};

const buildStatusBreakdown = (orders) => {
  const grouped = orders.reduce((accumulator, order) => {
    accumulator[order.status] = (accumulator[order.status] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count);
};

const buildOrderRows = (orders) =>
  orders.map((order) => ({
    orderId: order.id,
    createdAt: order.createdAt,
    clientName: order.clientName,
    clientCompany: order.clientCompany,
    serviceType: order.serviceType,
    signerName: order.signerName,
    status: order.status,
    notaryName: order.notary || "Unassigned",
    feeAmount: Number(order.feeAmount || 0),
    city: order.propertyAddress?.city || "",
    state: order.propertyAddress?.state || "",
    signingDate: order.signingDate,
    signingTime: order.signingTime,
  }));

const buildPaymentRows = (payments) =>
  payments.flatMap((payment) => {
    const clientRow = {
      paymentId: payment.id,
      orderId: payment.orderId,
      direction: "Inbound",
      counterpartyName: payment.clientCompany || payment.clientName,
      counterpartyEmail: payment.clientEmail,
      serviceType: payment.serviceType,
      amount: Number(payment.clientPayment?.amount || 0),
      status: payment.clientPayment?.status || "Pending",
      method: payment.clientPayment?.method || "",
      dueDate: payment.clientPayment?.dueDate || "",
      paidDate: payment.clientPayment?.paidDate || "",
      createdAt: payment.createdAt,
    };

    const rows = [clientRow];

    if (payment.notaryId || Number(payment.notaryPayout?.amount || 0) > 0) {
      rows.push({
        paymentId: payment.id,
        orderId: payment.orderId,
        direction: "Outbound",
        counterpartyName: payment.notaryName || "Unassigned notary",
        counterpartyEmail: payment.notaryEmail || "",
        serviceType: payment.serviceType,
        amount: Number(payment.notaryPayout?.amount || 0),
        status: payment.notaryPayout?.status || "Pending",
        method: payment.notaryPayout?.method || "",
        dueDate: payment.notaryPayout?.dueDate || "",
        paidDate: payment.notaryPayout?.paidDate || "",
        createdAt: payment.createdAt,
      });
    }

    return rows;
  });

const filterOrders = (orders, query) => {
  const { dateFrom, dateTo } = buildDateRange(query);

  return orders.filter((order) => {
    if ((query.status || "").trim() && order.status !== query.status) {
      return false;
    }

    if (!matchesDateRange(order.createdAt, dateFrom, dateTo)) {
      return false;
    }

    if (query.search) {
      const haystack = [
        order.id,
        order.clientName,
        order.clientCompany,
        order.signerName,
        order.notary,
        order.serviceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(String(query.search).toLowerCase());
    }

    return true;
  });
};

const filterPaymentRows = (rows, query) => {
  const { dateFrom, dateTo } = buildDateRange(query);

  return rows.filter((row) => {
    if (query.direction && row.direction !== query.direction) {
      return false;
    }
    if (query.status && row.status !== query.status) {
      return false;
    }
    if (!matchesDateRange(row.createdAt, dateFrom, dateTo)) {
      return false;
    }
    if (query.search) {
      const haystack = [
        row.orderId,
        row.counterpartyName,
        row.counterpartyEmail,
        row.serviceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(String(query.search).toLowerCase());
    }
    return true;
  });
};

const buildDashboardStatsPayload = ({ orders, payments, users }) => {
  const totalRevenue = payments.reduce(
    (total, payment) => total + Number(payment.totalClientAmount || 0),
    0
  );
  const totalPayouts = payments.reduce(
    (total, payment) => total + Number(payment.notaryPayoutAmount || 0),
    0
  );
  const totalProfit = payments.reduce(
    (total, payment) => total + Number(payment.companyRevenueAmount || 0),
    0
  );

  const completedOrders = orders.filter((order) => order.status === "Completed").length;
  const activeOrders = orders.filter((order) =>
    ["Accepted By Notary", "In Progress", "Notary Assigned"].includes(order.status)
  ).length;
  const pendingOrders = orders.filter((order) =>
    ["Pending Admin Review", "Accepted By Admin", "Needs Reassignment"].includes(order.status)
  ).length;

  const inboundByMethod = payments.reduce((accumulator, payment) => {
    const method = payment.clientPayment?.method || "Unspecified";
    accumulator[method] = (accumulator[method] || 0) + Number(payment.clientPayment?.amount || 0);
    return accumulator;
  }, {});

  const clientActivity = users.filter((user) => user.role === "Client").length;
  const notaryCount = users.filter((user) => user.role === "Notary").length;

  const topNotaries = users
    .filter((user) => user.role === "Notary")
    .map((user) => {
      const userOrders = orders.filter((order) => order.notaryId === user.id);
      return {
        id: user.id,
        name: user.name,
        completedOrders: userOrders.filter((order) => order.status === "Completed").length,
        totalOrders: userOrders.length,
        totalPayout: payments
          .filter((payment) => payment.notaryId === user.id)
          .reduce(
            (total, payment) => total + Number(payment.notaryPayoutAmount || 0),
            0
          ),
      };
    })
    .sort((left, right) => {
      if (right.completedOrders !== left.completedOrders) {
        return right.completedOrders - left.completedOrders;
      }
      return right.totalPayout - left.totalPayout;
    })
    .slice(0, 5);

  return {
    summary: {
      totalOrders: orders.length,
      completedOrders,
      activeOrders,
      pendingOrders,
      totalRevenue,
      totalPayouts,
      totalProfit,
      totalClients: clientActivity,
      totalNotaries: notaryCount,
    },
    revenueSeries: buildMonthlySeries(
      payments,
      (payment) => payment.totalClientAmount,
      (payment) => payment.createdAt
    ),
    payoutSeries: buildMonthlySeries(
      payments,
      (payment) => payment.notaryPayoutAmount,
      (payment) => payment.createdAt
    ),
    ordersByStatus: buildStatusBreakdown(orders),
    paymentMethods: Object.entries(inboundByMethod)
      .map(([method, amount]) => ({ method, amount }))
      .sort((left, right) => right.amount - left.amount),
    topNotaries,
    recentOrders: buildOrderRows(
      [...orders]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 8)
    ),
  };
};

reportsRouter.get(
  "/admin/reports/dashboard-stats",
  requireAdminAuth,
  validate(baseReportSchema),
  async (req, res) => {
    const [orders, users] = await Promise.all([
      OrderModel.find().lean(),
      UserModel.find().lean(),
    ]);
    const filteredOrders = filterOrders(orders, req.query);
    const payments = await ensurePaymentsForOrders(filteredOrders);
    return ok(
      res,
      buildDashboardStatsPayload({
        orders: filteredOrders,
        payments,
        users,
      })
    );
  }
);

reportsRouter.get(
  "/admin/reports/orders",
  requireAdminAuth,
  validate(baseReportSchema),
  async (req, res) => {
    const orders = filterOrders(await OrderModel.find().lean(), req.query);
    const rows = buildOrderRows(
      [...orders].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    );

    if (req.query.format === "csv") {
      return sendCsv(res, "orders-report.csv", rows);
    }

    const totalValue = orders.reduce(
      (total, order) => total + Number(order.feeAmount || 0),
      0
    );

    return ok(res, {
      filters: {
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
        status: req.query.status || null,
      },
      summary: {
        totalOrders: orders.length,
        pendingOrders: orders.filter((order) => order.status === "Pending Admin Review").length,
        assignedOrders: orders.filter((order) =>
          ["Notary Assigned", "Accepted By Notary"].includes(order.status)
        ).length,
        completedOrders: orders.filter((order) => order.status === "Completed").length,
        totalValue,
      },
      orders: rows,
    });
  }
);

reportsRouter.get(
  "/admin/reports/payments",
  requireAdminAuth,
  validate(baseReportSchema),
  async (req, res) => {
    const payments = await PaymentModel.find().lean();
    const rows = filterPaymentRows(buildPaymentRows(payments), req.query).sort(
      (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
    );

    if (req.query.format === "csv") {
      return sendCsv(res, "payments-report.csv", rows);
    }

    return ok(res, {
      filters: {
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
        status: req.query.status || null,
        direction: req.query.direction || null,
      },
      summary: {
        totalRows: rows.length,
        totalInbound: rows
          .filter((row) => row.direction === "Inbound")
          .reduce((total, row) => total + Number(row.amount || 0), 0),
        totalOutbound: rows
          .filter((row) => row.direction === "Outbound")
          .reduce((total, row) => total + Number(row.amount || 0), 0),
        outstandingInbound: rows
          .filter((row) => row.direction === "Inbound" && row.status !== "Received")
          .reduce((total, row) => total + Number(row.amount || 0), 0),
        outstandingOutbound: rows
          .filter((row) => row.direction === "Outbound" && row.status !== "Paid")
          .reduce((total, row) => total + Number(row.amount || 0), 0),
      },
      payments: rows,
    });
  }
);

reportsRouter.get(
  "/admin/reports/notaries",
  requireAdminAuth,
  validate(baseReportSchema),
  async (req, res) => {
    const [users, orders, payments] = await Promise.all([
      UserModel.find({ role: "Notary" }).lean(),
      OrderModel.find().lean(),
      PaymentModel.find().lean(),
    ]);
    const filteredOrders = filterOrders(orders, req.query);

    const rows = users
      .map((user) => {
        const userOrders = filteredOrders.filter((order) => order.notaryId === user.id);
        const completedOrders = userOrders.filter((order) => order.status === "Completed").length;
        const rejectedOrders = userOrders.filter((order) => order.status === "Rejected By Notary").length;
        const payouts = payments
          .filter((payment) => payment.notaryId === user.id)
          .reduce(
            (total, payment) => total + Number(payment.notaryPayoutAmount || 0),
            0
          );

        return {
          notaryId: user.id,
          name: user.name,
          email: user.email,
          verification: user.verification,
          totalAssignments: userOrders.length,
          completedOrders,
          rejectedOrders,
          inProgressOrders: userOrders.filter((order) => order.status === "In Progress").length,
          completionRate:
            userOrders.length > 0
              ? Number(((completedOrders / userOrders.length) * 100).toFixed(1))
              : 0,
          totalPayout: payouts,
        };
      })
      .filter((row) => {
        if (!req.query.search) return true;
        const haystack = [row.name, row.email, row.notaryId].join(" ").toLowerCase();
        return haystack.includes(String(req.query.search).toLowerCase());
      })
      .sort((left, right) => {
        if (right.completedOrders !== left.completedOrders) {
          return right.completedOrders - left.completedOrders;
        }
        return right.totalPayout - left.totalPayout;
      });

    return ok(res, { notaries: rows });
  }
);

reportsRouter.get(
  "/admin/reports/clients",
  requireAdminAuth,
  validate(baseReportSchema),
  async (req, res) => {
    const [users, orders, payments] = await Promise.all([
      UserModel.find({ role: "Client" }).lean(),
      OrderModel.find().lean(),
      PaymentModel.find().lean(),
    ]);
    const filteredOrders = filterOrders(orders, req.query);

    const rows = users
      .map((user) => {
        const clientOrders = filteredOrders.filter((order) => order.clientUserId === user.id);
        const clientPayments = payments.filter((payment) => payment.clientUserId === user.id);
        const lastOrder = [...clientOrders].sort(
          (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
        )[0];

        return {
          clientId: user.id,
          name: user.name,
          email: user.email,
          company: user.company || user.organization?.companyName || "",
          ordersCreated: clientOrders.length,
          completedOrders: clientOrders.filter((order) => order.status === "Completed").length,
          totalSpend: clientPayments.reduce(
            (total, payment) => total + Number(payment.totalClientAmount || 0),
            0
          ),
          lastOrderAt: lastOrder?.createdAt || null,
          lastOrderLabel: lastOrder?.createdAt
            ? dateFormatter.format(new Date(lastOrder.createdAt))
            : "No orders yet",
        };
      })
      .filter((row) => {
        if (!req.query.search) return true;
        const haystack = [row.name, row.email, row.company, row.clientId]
          .join(" ")
          .toLowerCase();
        return haystack.includes(String(req.query.search).toLowerCase());
      })
      .sort((left, right) => right.ordersCreated - left.ordersCreated);

    return ok(res, { clients: rows });
  }
);
