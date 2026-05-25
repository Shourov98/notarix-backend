# Notarix API List

Base URL: `/api`

## 1. Authentication APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Login user |
| POST | `/auth/logout` | Authenticated | Logout user |
| POST | `/auth/refresh-token` | Public/Auth | Refresh JWT token |
| PATCH | `/auth/reset-password` | Authenticated | Change password after first login |
| POST | `/auth/forgot-password` | Public | Request password reset link |
| PATCH | `/auth/forgot-password/reset` | Public | Reset password using token |
| GET | `/auth/me` | Authenticated | Get current logged-in user |

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
| POST | `/users/bank-info` | Authenticated | Add bank information |
| GET | `/users/bank-info` | Authenticated | Get own bank information |
| PATCH | `/users/bank-info` | Authenticated | Update own bank information |
| GET | `/admin/users/:id/bank-info` | Admin/Super Admin | View user bank information |

---

## 5. Client Order APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/orders` | Client | Create new order |
| GET | `/orders` | Authenticated | Get own/role-based orders |
| GET | `/orders/:id` | Authenticated | Get order details |
| POST | `/orders/:id/documents` | Client/Admin/Notary | Upload order document |
| GET | `/orders/:id/documents` | Participants/Admin | Get order documents |
| PATCH | `/orders/:id/cancel` | Client/Admin | Cancel order |

---

## 6. Admin Order Management APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/orders` | Admin/Super Admin | Get all orders |
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
| GET | `/notary/assignments` | Notary | Get assigned orders |
| GET | `/notary/assignments/:id` | Notary | Get assignment details |
| PATCH | `/notary/orders/:id/accept` | Notary | Accept assignment |
| PATCH | `/notary/orders/:id/reject` | Notary | Reject assignment |
| PATCH | `/notary/orders/:id/start` | Notary | Mark order in progress |
| PATCH | `/notary/orders/:id/complete` | Notary | Mark order completed |
| POST | `/notary/orders/:id/completed-documents` | Notary | Upload signed/completed documents |

---

## 8. Conversation & Messaging APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/conversations` | Authenticated | Get user conversations |
| GET | `/conversations/order/:orderId` | Order participants/Admin | Get order conversation |
| GET | `/conversations/:id/messages` | Participants/Admin | Get messages |
| POST | `/conversations/:id/messages` | Participants/Admin | Send text message |
| POST | `/messages/:id/attachments` | Participants/Admin | Upload message attachments |
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
| GET | `/notary/payments` | Notary | Get notary payout records |
| GET | `/client/payments` | Client | Get client payment records |

---

## 10. Notification APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Get notifications |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one notification as read |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read |

---

## 11. Reports & Audit APIs

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard/stats` | Admin/Super Admin | Dashboard statistics |
| GET | `/admin/reports/orders` | Admin/Super Admin | Order reports |
| GET | `/admin/reports/payments` | Admin/Super Admin | Payment reports |
| GET | `/admin/audit-logs` | Admin/Super Admin | Get audit logs |
| GET | `/admin/export/orders` | Admin/Super Admin | Export orders CSV |
| GET | `/admin/export/payments` | Admin/Super Admin | Export payments CSV |

---

## 12. Socket Events

| Event | Direction | Purpose |
|---|---|---|
| `join_conversation` | Client to Server | Join order chat room |
| `send_message` | Client to Server | Send real-time message |
| `new_message` | Server to Client | Receive new message |
| `order_status_updated` | Server to Client | Real-time order update |
| `assignment_updated` | Server to Client | Real-time notary assignment update |
| `notification_created` | Server to Client | Receive notification |
