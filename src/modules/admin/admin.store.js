import crypto from "node:crypto";

const ticketId = () => `T-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

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

export const adminStore = {
  companySettings: defaultCompanySettings(),
  notificationPreferencesByAdmin: new Map(),
  supportTickets: new Map(),

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

  listSupportTickets({ status, search } = {}) {
    const tickets = Array.from(this.supportTickets.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const normalizedSearch = String(search || "").trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (status && ticket.status !== status) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [
        ticket.id,
        ticket.subject,
        ticket.body,
        ticket.requesterEmail,
        ticket.priority,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedSearch));
    });
  },

  getSupportTicket(id) {
    return this.supportTickets.get(String(id)) || null;
  },

  createSupportTicket({ subject, body, priority = "normal", requesterEmail = "" } = {}) {
    const now = new Date().toISOString();
    const ticket = {
      id: ticketId(),
      subject: String(subject || "").trim(),
      body: String(body || "").trim(),
      priority,
      requesterEmail: String(requesterEmail || "").trim(),
      status: "Open",
      assigneeId: null,
      notes: [],
      messages: [
        {
          id: crypto.randomUUID(),
          author: requesterEmail ? requesterEmail : "requester",
          authorRole: "requester",
          body: String(body || "").trim(),
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.supportTickets.set(ticket.id, ticket);
    return { ...ticket };
  },

  updateSupportTicket(id, patch = {}) {
    const existing = this.supportTickets.get(String(id));
    if (!existing) {
      return null;
    }
    const now = new Date().toISOString();
    const next = {
      ...existing,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
      ...(patch.notes !== undefined
        ? {
            notes: Array.isArray(patch.notes)
              ? patch.notes
              : [...existing.notes, { body: String(patch.notes), createdAt: now }],
          }
        : {}),
      updatedAt: now,
    };
    if (patch.reply) {
      next.messages = [
        ...existing.messages,
        {
          id: crypto.randomUUID(),
          author: patch.replyAuthor || "admin",
          authorRole: "admin",
          body: String(patch.reply),
          createdAt: now,
        },
      ];
    }
    this.supportTickets.set(String(id), next);
    return { ...next };
  },
};
