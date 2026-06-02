# Notarix API List

Base URL: `/api/v1`

## 1. Authentication APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/admin/auth/login` | Public | Login admin or super admin |
| POST | `/site/auth/login` | Public | Login client or notary |
| POST | `/admin/auth/logout` | Admin/Super Admin | Logout admin |
| POST | `/admin/auth/refresh` | Public/Auth | Refresh admin session token |
| PATCH | `/auth/reset-password` | Admin/Super Admin | Change admin password after first login |
| PATCH | `/site/auth/reset-password` | Client/Notary | Change portal password after first login |
| POST | `/admin/auth/forgot-password` | Public | Request admin password reset OTP |
| POST | `/admin/auth/resend-forgot-otp` | Public | Resend admin password reset OTP |
| POST | `/admin/auth/verify-forgot-otp` | Public | Verify admin password reset OTP |
| POST | `/admin/auth/reset-password` | Public | Complete admin forgot-password reset |
| GET | `/auth/me` | Admin/Super Admin | Get current logged-in admin |

---

## 2. Public User Request APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/requests` | Public | Client/Notary submits access request |
| GET | `/admin/requests` | Admin/Super Admin | Get all access requests |
| GET | `/admin/requests/:id` | Admin/Super Admin | Get single request details |
| PATCH | `/admin/requests/:id/approve` | Admin/Super Admin | Approve access request |
| PATCH | `/admin/requests/:id/reject` | Admin/Super Admin | Reject access request |

---

## 3. User Management APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/users` | Admin/Super Admin | Get all users |
| GET | `/admin/users/:id` | Admin/Super Admin | Get user details |
| POST | `/admin/users/client` | Admin/Super Admin | Create verified client |
| POST | `/admin/users/notary` | Admin/Super Admin | Create verified notary |
| POST | `/admin/users/admin` | Super Admin | Create admin |
| PATCH | `/admin/users/:id` | Admin/Super Admin | Update user |
| PATCH | `/admin/users/:id/status` | Admin/Super Admin | Active/Suspend user |
| DELETE | `/admin/users/:id` | Super Admin | Delete/deactivate user |
| POST | `/admin/users/:id/documents` | Admin/Super Admin | Upload verification documents |
| GET | `/admin/users/:id/documents` | Admin/Super Admin | Get user documents |

---

## 4. Bank Information APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/site/client/bank-info` | Client | Get own bank information |
| POST | `/site/client/bank-info` | Client | Add own bank information |
| PATCH | `/site/client/bank-info` | Client | Update own bank information |
| GET | `/site/notary/bank-info` | Notary | Get own bank information |
| POST | `/site/notary/bank-info` | Notary | Add own bank information |
| PATCH | `/site/notary/bank-info` | Notary | Update own bank information |
| GET | `/site/admin/users/:id/bank-info` | Admin/Super Admin | View masked user bank information |

---

## 5. Client Order APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/site/orders` | Client | Create new order |
| GET | `/site/client/orders` | Client | Get own client order list |
| GET | `/site/client/orders/:id` | Client | Get own order details |
| POST | `/site/orders/:id/documents` | Client | Upload order documents |

---

## 6. Admin Order Management APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/orders` | Admin/Super Admin | Get all orders (supports `search`, `status`, `serviceType`) |
| GET | `/admin/orders/:id` | Admin/Super Admin | Get order details |
| PATCH | `/admin/orders/:id/accept` | Admin/Super Admin | Accept client order |
| PATCH | `/admin/orders/:id/reject` | Admin/Super Admin | Reject client order |
| GET | `/admin/orders/:id/eligible-notaries` | Admin/Super Admin | Get eligible notaries by area |
| PATCH | `/admin/orders/:id/assign-notary` | Admin/Super Admin | Assign notary with payment terms |
| PATCH | `/admin/orders/:id/reassign-notary` | Admin/Super Admin | Assign another notary after rejection |
| PATCH | `/admin/orders/:id/status` | Admin/Super Admin | Manually update order status |

---

## 7. Notary Assignment APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/site/notary/assignments` | Notary | Get assigned orders |
| GET | `/site/notary/assignments/:id` | Notary | Get assignment details |
| PATCH | `/site/notary/orders/:id/accept` | Notary | Accept assignment |
| PATCH | `/site/notary/orders/:id/reject` | Notary | Reject assignment |
| PATCH | `/site/notary/orders/:id/start` | Notary | Mark order in progress |
| PATCH | `/site/notary/orders/:id/complete` | Notary | Mark order completed |
| POST | `/site/notary/orders/:id/completed-documents` | Notary | Upload signed/completed documents |

---

## 8. Conversation & Messaging APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/conversations` | Authenticated | Get user conversations |
| GET | `/conversations/order/:orderId` | Order participants/Admin | Get order conversation |
| GET | `/conversations/:id/messages` | Participants/Admin | Get messages |
| POST | `/conversations/:id/messages` | Participants/Admin | Send text message |
| POST | `/conversations/:id/attachments` | Participants/Admin | Upload message attachments |
| PATCH | `/messages/:id/read` | Participants/Admin | Mark message read |

---

## 9. Manual Payment APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/payments` | Admin/Super Admin | Get all payment records |
| GET | `/admin/orders/:id/payment` | Admin/Super Admin | Get order payment info |
| PATCH | `/admin/orders/:id/payment-terms` | Admin/Super Admin | Update payment terms |
| PATCH | `/admin/orders/:id/payment-status` | Admin/Super Admin | Update manual payment status |
| POST | `/admin/orders/:id/payment-proof` | Admin/Super Admin | Upload bank transfer proof |
| GET | `/site/notary/payments` | Notary | Get notary payout records |
| GET | `/site/client/payments` | Client | Get client payment records |

---

## 10. Notification APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Get notifications |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one notification as read |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read |

---

## 11. Secure File APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/files/users/:userId/avatar` | Owner/Admin | View or download profile photo |
| GET | `/files/users/:userId/documents/:documentId` | Owner/Admin | View or download verification document |
| GET | `/files/orders/:orderId/:bucket/:documentId` | Order participants/Admin | View or download order/completed document |
| GET | `/files/conversations/:conversationId/attachments/:attachmentId` | Participants/Admin | View or download message attachment |
| GET | `/files/payments/:orderId/:target/proof` | Related actor/Admin | View or download payment proof |

---

## 12. Reports & Audit APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard/stats` | Admin/Super Admin | Legacy dashboard statistics |
| GET | `/admin/reports/dashboard-stats` | Admin/Super Admin | Live reporting dashboard statistics with date filters |
| GET | `/admin/reports/orders` | Admin/Super Admin | Order reports with JSON or CSV export |
| GET | `/admin/reports/payments` | Admin/Super Admin | Payment reports with JSON or CSV export |
| GET | `/admin/reports/notaries` | Admin/Super Admin | Notary performance report |
| GET | `/admin/reports/clients` | Admin/Super Admin | Client activity report |
| GET | `/admin/audit-logs` | Admin/Super Admin | Get audit logs |

---

## 13. Socket Events

| Event | Direction | Purpose |
|---|---|---|
| `join_conversation` | Client to Server | Join order chat room |
| `send_message` | Client to Server | Send real-time message |
| `new_message` | Server to Client | Receive new message |
| `order_status_updated` | Server to Client | Real-time order update |
| `assignment_updated` | Server to Client | Real-time notary assignment update |
| `new_notification` | Server to Client | Receive notification |
