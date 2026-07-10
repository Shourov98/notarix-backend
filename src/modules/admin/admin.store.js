import crypto from "node:crypto";

const ticketId = () => `T-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const caseCode = () =>
  `TK-${crypto.randomBytes(2).toString("hex").toUpperCase().padStart(4, "0").slice(0, 4)}`;

const defaultCompanySettings = () => ({
  name: "Notarix",
  legalName: "Notarix Inc.",
  taxId: "",
  supportEmail: "support@notarix.com",
  supportPhone: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
  },
  branding: {
    primaryColor: "#2349db",
    accentColor: "#3152c7",
    logoUrl: "",
  },
  updatedAt: new Date().toISOString(),
});

const defaultNotificationPreferences = () => ({
  email: true,
  inApp: true,
  orderEvents: true,
  messageEvents: true,
  weeklyDigest: false,
  updatedAt: new Date().toISOString(),
});

// Allowed values for the rich ticket fields.
const ALLOWED_SEVERITIES = ["Low", "Normal", "High", "Critical"];
const ALLOWED_STATUSES = ["Open", "In Progress", "Resolved", "Pending", "Closed"];
const ALLOWED_REQUESTER_ROLES = ["Client", "Notary", "System"];

const cloneTicket = (ticket) => ({
  ...ticket,
  messages: Array.isArray(ticket.messages) ? ticket.messages.map((m) => ({ ...m })) : [],
  attachments: Array.isArray(ticket.attachments)
    ? ticket.attachments.map((a) => ({ ...a }))
    : [],
  auditTrail: Array.isArray(ticket.auditTrail)
    ? ticket.auditTrail.map((entry) => ({ ...entry }))
    : [],
});

// Build the in-memory audit entry helper.
const makeAuditEntry = ({ actor = "admin", actorRole = "admin", action, note }) => ({
  id: crypto.randomUUID(),
  actor,
  actorRole,
  action,
  note: note || null,
  createdAt: new Date().toISOString(),
});

// Seed default support tickets so the admin dashboard has populated content
// on a fresh server boot. The Digital Seal Sync Error case is included as the
// flagship sample ticket that powers the rich detail view.
const seedSupportTickets = () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const minutes = 60 * 1000;

  const items = [
    {
      id: "T-A1B2C3D4",
      caseCode: "TK-8821",
      subject: "Digital Seal Sync Error",
      body:
        "The user reports that the digital seal fails to synchronize during the final verification step. This issue occurs specifically when attempting to finalize a Remote Online Notarization (RON) session for multi-page PDF documents. The verification log shows a 'HASH_MISMATCH_ERROR' during the cryptographic binding phase.",
      priority: "high",
      severity: "High",
      status: "In Progress",
      requesterEmail: "m.rivera@notarix-partner.com",
      requesterName: "Marcus Rivera",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [
        {
          id: "att-1",
          name: "error_screenshot.png",
          mimeType: "image/png",
          size: 1.2 * 1024 * 1024,
          kind: "image",
          url: "#",
        },
      ],
      messages: [
        {
          id: "msg-1",
          author: "Marcus Rivera",
          authorRole: "requester",
          body:
            "Hi Support, I'm currently in the middle of a high-priority closing and the digital seal won't apply to the final document. I keep getting an error message saying synchronization failed. I've attached a screenshot of the console log. Please help ASAP!",
          createdAt: new Date(now - 3 * 60 * minutes).toISOString(),
        },
        {
          id: "msg-2",
          author: "Support Team (Admin)",
          authorRole: "admin",
          body:
            "Hello Marcus, thank you for reaching out. We've identified the HASH_MISMATCH_ERROR in your logs. It seems to be related to the document's layer flattening process. Our engineering team is looking into it now. Are you able to try re-uploading the document as a flat PDF in the meantime?",
          createdAt: new Date(now - 90 * minutes).toISOString(),
        },
        {
          id: "msg-3",
          author: "Marcus Rivera",
          authorRole: "requester",
          body:
            "I've tried re-uploading, but the same error persists. The client is waiting on the call. Is there any workaround or a patch coming shortly?",
          createdAt: new Date(now - 30 * minutes).toISOString(),
        },
      ],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Marcus Rivera",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 4 * 60 * minutes).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → In Progress",
          note: "Acknowledged by Sterling Lx",
          createdAt: new Date(now - 90 * minutes).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Admin Reply Sent",
          note: null,
          createdAt: new Date(now - 90 * minutes).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "System",
          actorRole: "system",
          action: "System Alert: Sync Lag Detected",
          note: "Sync lag detected upstream",
          createdAt: new Date(now - 1 * day - 30 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 4 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 30 * minutes).toISOString(),
    },
    {
      id: "T-E5F6A7B8",
      caseCode: "TK-7302",
      subject: "Unable to update menu pricing in dashboard",
      body:
        "When I try to update the price of a menu item, the form submits but the change doesn't persist after refresh.",
      priority: "normal",
      severity: "Normal",
      status: "Open",
      requesterEmail: "john.doe@firstamerican.example",
      requesterName: "John Doe",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [
        {
          id: crypto.randomUUID(),
          author: "John Doe",
          authorRole: "requester",
          body:
            "When I try to update the price of a menu item, the form submits but the change doesn't persist after refresh.",
          createdAt: new Date(now - 1 * day).toISOString(),
        },
      ],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "John Doe",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 1 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 1 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
    },
    {
      id: "T-C9D0E1F2",
      caseCode: "TK-7303",
      subject: "Payment integration failure for online orders",
      body:
        "Card payments for online orders intermittently fail with a 'gateway_timeout' error during peak hours.",
      priority: "high",
      severity: "High",
      status: "Open",
      requesterEmail: "maria.santos@lapaznotary.example",
      requesterName: "Maria Santos",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [
        {
          id: crypto.randomUUID(),
          author: "Maria Santos",
          authorRole: "requester",
          body:
            "Card payments for online orders intermittently fail with a 'gateway_timeout' error during peak hours.",
          createdAt: new Date(now - 6 * 60 * minutes).toISOString(),
        },
      ],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Maria Santos",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 6 * 60 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 6 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 6 * 60 * minutes).toISOString(),
    },
    {
      id: "T-3344AABB",
      caseCode: "TK-7298",
      subject: "Printer connectivity issue on POS terminal",
      body: "POS terminal in store #14 cannot detect the receipt printer.",
      priority: "normal",
      severity: "Normal",
      status: "Resolved",
      requesterEmail: "robert.king@capitoltitle.example",
      requesterName: "Robert King",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Robert King",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 2 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 1 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 1 * day).toISOString(),
    },
    {
      id: "T-5566CCDD",
      caseCode: "TK-7299",
      subject: "Refund request for cancelled order #10293",
      body: "Customer is requesting a refund for order #10293 cancelled within 24 hours.",
      priority: "normal",
      severity: "Normal",
      status: "Resolved",
      requesterEmail: "anita.lee@bluesky.notary",
      requesterName: "Anita Lee",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Anita Lee",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 3 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 2 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 3 * day).toISOString(),
      updatedAt: new Date(now - 2 * day).toISOString(),
    },
    {
      id: "T-7788EEFF",
      caseCode: "TK-7290",
      subject: "Account access revoked unexpectedly",
      body: "Woke up to a 403 on every page; password reset link is not arriving.",
      priority: "high",
      severity: "High",
      status: "Open",
      requesterEmail: "david.chen@silverline.example",
      requesterName: "David Chen",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "David Chen",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 5 * 60 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 5 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 5 * 60 * minutes).toISOString(),
    },
    {
      id: "T-9900FFAA",
      caseCode: "TK-7289",
      subject: "Bulk upload rejects CSV > 5MB",
      body: "We have 12 MB of orders to import and the bulk upload tool returns 'file_too_large'.",
      priority: "normal",
      severity: "Normal",
      status: "In Progress",
      requesterEmail: "olivia.bennett@highland.example",
      requesterName: "Olivia Bennett",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Olivia Bennett",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 30 * 60 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 30 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 30 * 60 * minutes).toISOString(),
    },
    {
      id: "T-AABB1122",
      caseCode: "TK-7285",
      subject: "Webhook events firing twice per order",
      body: "Our webhook listener is receiving each order.created event twice in a row.",
      priority: "urgent",
      severity: "Critical",
      status: "Open",
      requesterEmail: "sam.patel@apexlogistics.example",
      requesterName: "Sam Patel",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Sam Patel",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 4 * 60 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 4 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 4 * 60 * minutes).toISOString(),
    },
    {
      id: "T-CCDD3344",
      caseCode: "TK-7280",
      subject: "Report export missing revenue column",
      body: "The CSV export from Reports is missing the 'total_revenue' column.",
      priority: "low",
      severity: "Low",
      status: "Resolved",
      requesterEmail: "rachel.morgan@coastalbank.example",
      requesterName: "Rachel Morgan",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Rachel Morgan",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 5 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 4 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 5 * day).toISOString(),
      updatedAt: new Date(now - 4 * day).toISOString(),
    },
    {
      id: "T-EEFF5566",
      caseCode: "TK-7275",
      subject: "Onboarding email never arrived",
      body: "New teammate never received the onboarding welcome email.",
      priority: "normal",
      severity: "Normal",
      status: "Resolved",
      requesterEmail: "liam.osullivan@apex.notary",
      requesterName: "Liam O'Sullivan",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Liam O'Sullivan",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 6 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 5 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 6 * day).toISOString(),
      updatedAt: new Date(now - 5 * day).toISOString(),
    },
    {
      id: "T-11223344",
      caseCode: "TK-7271",
      subject: "API returns 502 on /orders?status=pending",
      body: "Filtering orders by status=pending returns intermittent 502s.",
      priority: "high",
      severity: "High",
      status: "Open",
      requesterEmail: "noah.kim@buildright.example",
      requesterName: "Noah Kim",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Noah Kim",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 45 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 45 * minutes).toISOString(),
      updatedAt: new Date(now - 45 * minutes).toISOString(),
    },
    {
      id: "T-55667788",
      caseCode: "TK-7260",
      subject: "Document e-signature misaligned on mobile",
      body: "Signatures drawn on mobile are positioned several pixels off on the final PDF.",
      priority: "normal",
      severity: "Normal",
      status: "Pending",
      requesterEmail: "isabella.romero@coastaltitle.example",
      requesterName: "Isabella Romero",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Isabella Romero",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 18 * 60 * minutes).toISOString(),
        },
      ],
      createdAt: new Date(now - 18 * 60 * minutes).toISOString(),
      updatedAt: new Date(now - 18 * 60 * minutes).toISOString(),
    },
    {
      id: "T-99AABBCC",
      caseCode: "TK-7255",
      subject: "Two-factor reset link expired too quickly",
      body: "The 2FA reset link expires in under 2 minutes; can't complete the flow.",
      priority: "high",
      severity: "High",
      status: "Resolved",
      requesterEmail: "henry.diaz@matrixbank.example",
      requesterName: "Henry Diaz",
      requesterRole: "Client",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Henry Diaz",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 8 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 7 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 8 * day).toISOString(),
      updatedAt: new Date(now - 7 * day).toISOString(),
    },
    {
      id: "T-DDEEFF11",
      caseCode: "TK-7250",
      subject: "Cannot invite new admin from the team page",
      body: "The 'Invite Admin' form shows 'Forbidden' even though I'm a Super Admin.",
      priority: "normal",
      severity: "Normal",
      status: "Resolved",
      requesterEmail: "sophia.gomez@cascade.notary",
      requesterName: "Sophia Gomez",
      requesterRole: "Notary",
      requesterUserId: null,
      assignee: null,
      attachments: [],
      messages: [],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: "Sophia Gomez",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: new Date(now - 9 * day).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          actor: "Sterling Lx",
          actorRole: "admin",
          action: "Status: Open → Resolved",
          note: null,
          createdAt: new Date(now - 8 * day).toISOString(),
        },
      ],
      createdAt: new Date(now - 9 * day).toISOString(),
      updatedAt: new Date(now - 8 * day).toISOString(),
    },
  ];

  return items;
};

export const adminStore = {
  companySettings: defaultCompanySettings(),
  notificationPreferencesByAdmin: new Map(),
  supportTickets: new Map(),
  __seeded: false,

  ensureSeeded() {
    if (this.__seeded) return;
    if (this.supportTickets.size > 0) {
      this.__seeded = true;
      return;
    }
    seedSupportTickets().forEach((ticket) => {
      this.supportTickets.set(ticket.id, ticket);
    });
    this.__seeded = true;
  },

  getCompanySettings() {
    return { ...this.companySettings };
  },

  updateCompanySettings(patch = {}) {
    this.companySettings = {
      ...this.companySettings,
      ...patch,
      address: { ...this.companySettings.address, ...(patch.address || {}) },
      branding: { ...this.companySettings.branding, ...(patch.branding || {}) },
      updatedAt: new Date().toISOString(),
    };
    return { ...this.companySettings };
  },

  getNotificationPreferences(adminId) {
    if (!adminId) {
      return defaultNotificationPreferences();
    }
    const existing = this.notificationPreferencesByAdmin.get(String(adminId));
    if (existing) {
      return { ...existing };
    }
    const seeded = defaultNotificationPreferences();
    this.notificationPreferencesByAdmin.set(String(adminId), seeded);
    return { ...seeded };
  },

  updateNotificationPreferences(adminId, patch = {}) {
    const current = this.getNotificationPreferences(adminId);
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.notificationPreferencesByAdmin.set(String(adminId), next);
    return { ...next };
  },

  listSupportTickets({ status, search, page = 1, pageSize = 25 } = {}) {
    this.ensureSeeded();

    const all = Array.from(this.supportTickets.values()).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    const normalizedSearch = String(search || "").trim().toLowerCase();

    const filtered = all.filter((ticket) => {
      if (status && ticket.status !== status) {
        return false;
      }
      if (!normalizedSearch) return true;
      return [
        ticket.id,
        ticket.caseCode,
        ticket.subject,
        ticket.body,
        ticket.requesterEmail,
        ticket.requesterName,
        ticket.requesterRole,
        ticket.severity,
        ticket.status,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedSearch));
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(cloneTicket);

    return {
      items,
      pagination: {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
    };
  },

  countSupportTickets() {
    this.ensureSeeded();
    const all = Array.from(this.supportTickets.values());
    const byStatus = all.reduce((acc, ticket) => {
      const key = ticket.status || "Open";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      total: all.length,
      active: all.filter((t) => ["Open", "In Progress", "Pending"].includes(t.status)).length,
      resolved: all.filter((t) => t.status === "Resolved").length,
      byStatus,
    };
  },

  getSupportTicket(id) {
    this.ensureSeeded();
    const ticket = this.supportTickets.get(String(id));
    if (!ticket) return null;
    return cloneTicket(ticket);
  },

  createSupportTicket(input = {}) {
    const now = new Date().toISOString();
    const requesterName = String(input.requesterName || "").trim();
    const requesterEmail = String(input.requesterEmail || "").trim();
    const requesterRole = ALLOWED_REQUESTER_ROLES.includes(input.requesterRole)
      ? input.requesterRole
      : "Client";
    const severity = ALLOWED_SEVERITIES.includes(input.severity)
      ? input.severity
      : "Normal";

    const initialMessage = {
      id: crypto.randomUUID(),
      author: requesterName || requesterEmail || "requester",
      authorRole: "requester",
      body: String(input.body || "").trim(),
      createdAt: now,
    };

    const ticket = {
      id: ticketId(),
      caseCode: caseCode(),
      subject: String(input.subject || "").trim(),
      body: String(input.body || "").trim(),
      priority: input.priority || "normal",
      severity,
      status: "Open",
      requesterEmail,
      requesterName,
      requesterRole,
      requesterUserId: input.requesterUserId || null,
      assignee: null,
      attachments: Array.isArray(input.attachments)
        ? input.attachments.map((a) => ({ ...a, id: a.id || crypto.randomUUID() }))
        : [],
      messages: [initialMessage],
      auditTrail: [
        {
          id: crypto.randomUUID(),
          actor: requesterName || requesterEmail || "requester",
          actorRole: "requester",
          action: "Ticket Created",
          note: null,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.supportTickets.set(ticket.id, ticket);
    return cloneTicket(ticket);
  },

  updateSupportTicket(id, patch = {}) {
    const existing = this.supportTickets.get(String(id));
    if (!existing) return null;
    const now = new Date().toISOString();
    const auditTrail = [...existing.auditTrail];
    const messages = [...existing.messages];

    if (patch.status && ALLOWED_STATUSES.includes(patch.status) && patch.status !== existing.status) {
      auditTrail.unshift(
        makeAuditEntry({
          actor: "Sterling Lx",
          actorRole: "admin",
          action: `Status: ${existing.status} → ${patch.status}`,
          note: null,
        })
      );
    }

    if (patch.severity && ALLOWED_SEVERITIES.includes(patch.severity)) {
      if (patch.severity !== existing.severity) {
        auditTrail.unshift(
          makeAuditEntry({
            actor: "Sterling Lx",
            actorRole: "admin",
            action: `Severity: ${existing.severity || "Normal"} → ${patch.severity}`,
            note: null,
          })
        );
      }
    }

    if (patch.reply) {
      messages.push({
        id: crypto.randomUUID(),
        author: patch.replyAuthor || "Support Team (Admin)",
        authorRole: "admin",
        body: String(patch.reply),
        createdAt: now,
      });
      auditTrail.unshift(
        makeAuditEntry({
          actor: patch.replyAuthor || "Sterling Lx",
          actorRole: "admin",
          action: "Admin Reply Sent",
          note: null,
        })
      );
    }

    let attachments = existing.attachments;
    if (Array.isArray(patch.attachments) && patch.attachments.length > 0) {
      const incoming = patch.attachments.map((a) => ({
        ...a,
        id: a.id || crypto.randomUUID(),
        uploadedAt: now,
      }));
      attachments = [...attachments, ...incoming];
      auditTrail.unshift(
        makeAuditEntry({
          actor: patch.replyAuthor || "Sterling Lx",
          actorRole: "admin",
          action: "Attachment Added",
          note: incoming.map((a) => a.name).join(", "),
        })
      );
    }

    const next = {
      ...existing,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.severity ? { severity: patch.severity } : {}),
      ...(patch.assignee !== undefined ? { assignee: patch.assignee } : {}),
      ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
      messages,
      attachments,
      auditTrail,
      updatedAt: now,
    };

    if (patch.notes !== undefined) {
      const note = typeof patch.notes === "string"
        ? {
            id: crypto.randomUUID(),
            author: "Sterling Lx",
            authorRole: "admin",
            action: "Note Added",
            note: patch.notes,
            createdAt: now,
          }
        : patch.notes;
      next.auditTrail = [note, ...next.auditTrail];
    }

    this.supportTickets.set(String(id), next);
    return cloneTicket(next);
  },
};