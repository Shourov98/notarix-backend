# Notarix Platform — Complete System Scope & API Specification

# 1. Project Overview

## Platform Name
Notarix

## Platform Type
Remote Notary & Order Management Platform

## Main Roles

### 1. Super Admin
Full system control.

Permissions:
- Create/manage Admins
- View all users
- View all orders
- View reports
- Suspend users
- Monitor audit logs
- Access conversations
- Access payments

---

### 2. Admin
Operational management role.

Permissions:
- Review account requests
- Approve/reject clients & notaries
- Create verified users
- Verify documents
- Create orders manually
- Assign notaries
- Monitor orders
- Participate in order conversations
- Manage payments
- View reports

---

### 3. Client
Creates notarization orders.

Permissions:
- Request account access
- Login after approval
- Create orders
- Upload documents
- View order status
- Chat with admin & notary
- View invoices
- Download completed documents

---

### 4. Notary
Executes notarization assignments.

Permissions:
- Request account access
- Accept assignments
- View assigned orders
- Upload signed documents
- Participate in order chat
- Mark order completed
- View earnings

---

# 2. Technology Scope

## Frontend
Recommended:
- Next.js
- React
- Tailwind CSS
- Zustand / Redux
- Socket.IO Client

---

## Backend
Recommended:
- Node.js
- Express.js
- Socket.IO
- JWT Authentication
- Multer (File Upload)
- Cloudinary / AWS S3

---

## Database
MongoDB

Collections:
- users
- userRequests
- orders
- orderDocuments
- conversations
- messages
- notifications
- payments
- auditLogs

---

## Authentication
- JWT Access Token
- Refresh Token
- Password Reset
- Role-Based Access

---

## Storage
Recommended:
- AWS S3
OR
- Cloudinary

---

## Real-Time System
Socket.IO

Used For:
- Messaging
- Notifications
- Order Updates
- Live Assignment Updates

---

# 3. Complete System Workflow

# PHASE 1 — USER ACCESS REQUEST

## Client / Notary Request Flow

### Frontend
Public Request Form:

Fields:
- Name
- Email
- Company Name
- Phone Number
- Contact Type
- Request Type
- State
- Message

---

### Backend Flow

1. User submits request
2. System creates request
3. Status = Pending
4. Admin notified

---

## MongoDB Collection

```json
{
  "_id": "ObjectId",
  "name": "John Smith",
  "email": "john@example.com",
  "companyName": "ABC Title",
  "phone": "+1-555-000-0000",
  "contactType": "Company",
  "requestType": "Client",
  "state": "Texas",
  "message": "Need account access",
  "status": "Pending",
  "createdAt": "ISODate"
}
```

---

# PHASE 2 — ADMIN REVIEW

## Admin Actions

Admin can:
- View request
- Verify information
- Approve request
- Reject request

---

## Approved Flow

If approved:
- Admin creates verified user
- System generates credentials
- Email sent
- Password reset required

---

# PHASE 3 — USER CREATION

# CLIENT CREATION

## Required Fields

### Organization Information
- Company Name
- Company Type
- Website
- Main Office Phone

### Address
- Address Line 1
- Address Line 2
- City
- State
- ZIP Code

### Contacts
- Primary Contact
- Secondary Contact

### Required Documents
- Service Agreement
- W-9
- Business License
- Billing Setup Form
- Portal Authorization

---

# NOTARY CREATION

## Required Fields

### Personal Information
- Full Name
- Email
- Phone Number
- Profile Photo

### Address Information
- Address
- City
- State
- ZIP

### Commission Details
- Commission Number
- Commission State
- Expiration Date
- Travel Radius
- Coverage Areas

### Required Documents
- Commission Certificate
- E&O Insurance
- Background Check
- Government ID

---

# Verification Rules

## Important

If admin uploads documents:
- Status = Verified

If missing:
- Status = Missing

---

# Password Rules

- Password auto-generated
- User cannot use initial password permanently
- Must reset password on first login

---

# PHASE 4 — CLIENT ORDER CREATION

# Client Order Workflow

## Frontend Form Sections

### Client Information
- Vendor Code
- Service Type

### Borrower Information
- First Name
- Last Name
- Phone
- Email
- Secondary Signer

### Property & Signing Details
- Address
- City
- State
- ZIP
- Time Zone
- Signing Date
- Signing Time

### Payment Details
- Fee Amount
- Payment Status
- Payment Method
- Due Date
- Paid Date

### Service Details
- Paper Size
- Preferred Ink
- Estimated Pages
- RON Toggle

### Special Instructions
- Text Area

### Document Upload
- PDF
- DOC
- DOCX

---

# Order Status Lifecycle

```text
Pending
Assigned
Accepted
In Progress
Completed
Cancelled
Rejected
```

---

# PHASE 5 — ADMIN ORDER MANAGEMENT

## Admin Can

- View all orders
- Filter orders
- Review documents
- Assign notary
- Monitor progress
- Access order chat
- Export CSV

---

# Notary Assignment Logic

Admin assigns notary based on:
- State
- Coverage Area
- Availability
- Verification Status
- Travel Radius

---

# PHASE 6 — ORDER CONVERSATION SYSTEM

# Core Rule

Every order automatically creates:

```text
1 Order = 1 Permanent Conversation
```

Participants:
- Client
- Admin
- Assigned Notary

---

# Messaging Features

## Supported Types

### Text
### Images
### Files

Supported Attachments:
- PDF
- DOC
- DOCX
- JPG
- PNG
- ZIP

---

# Conversation Rules

- Never deleted automatically
- Stored forever
- Used as audit trail
- Only participants can access

---

# PHASE 7 — NOTARY EXECUTION

## Notary Actions

### Assignment Dashboard
Notary can:
- View assignments
- Accept assignment
- Start session
- Upload documents
- Communicate
- Mark complete

---

# RON Session

Currently:
- No Zoom API
- Video session placeholder only

Future Ready:
- Zoom SDK
- Agora
- Twilio Video

---

# PHASE 8 — ORDER COMPLETION

## Completion Flow

When notary clicks:

```text
Mark Complete
```

System:
- Updates status
- Saves documents
- Updates audit logs
- Sends notifications
- Generates invoice

---

# 4. MongoDB Collections

# users

```json
{
  "_id": "ObjectId",
  "role": "Client",
  "name": "John",
  "email": "john@example.com",
  "passwordHash": "hashed",
  "passwordResetRequired": true,
  "status": "Active",
  "verified": true,
  "createdBy": "adminId",
  "createdAt": "ISODate"
}
```

---

# orders

```json
{
  "_id": "ObjectId",
  "orderId": "RON-9402",
  "clientId": "ObjectId",
  "notaryId": "ObjectId",
  "status": "Pending",
  "serviceType": "Loan Signing",
  "location": {
    "state": "Texas",
    "city": "Austin"
  },
  "schedule": {
    "date": "2026-04-24",
    "time": "14:30"
  },
  "payment": {
    "fee": 150,
    "status": "Pending"
  },
  "createdAt": "ISODate"
}
```

---

# conversations

```json
{
  "_id": "ObjectId",
  "orderId": "ObjectId",
  "participants": [
    "clientId",
    "adminId",
    "notaryId"
  ],
  "createdAt": "ISODate"
}
```

---

# messages

```json
{
  "_id": "ObjectId",
  "conversationId": "ObjectId",
  "senderId": "ObjectId",
  "messageType": "text",
  "message": "Document uploaded",
  "attachments": [],
  "createdAt": "ISODate"
}
```

---

# notifications

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "title": "New Assignment",
  "message": "You received a new order",
  "read": false,
  "createdAt": "ISODate"
}
```

---

# auditLogs

```json
{
  "_id": "ObjectId",
  "orderId": "ObjectId",
  "action": "Order Completed",
  "performedBy": "notaryId",
  "timestamp": "ISODate"
}
```

---

# 5. Authentication APIs

# Login

## POST

```http
/api/auth/login
```

### Request Body

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Response

```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "123",
    "role": "Client"
  }
}
```

---

# Reset Password

## PATCH

```http
/api/auth/reset-password
```

### Request

```json
{
  "currentPassword": "old",
  "newPassword": "new123"
}
```

### Response

```json
{
  "success": true,
  "message": "Password updated"
}
```

---

# 6. User Request APIs

# Submit Request

## POST

```http
/api/requests
```

### Request

```json
{
  "name": "John",
  "email": "john@example.com",
  "requestType": "Client"
}
```

### Response

```json
{
  "success": true,
  "status": "Pending"
}
```

---

# Get Pending Requests

## GET

```http
/api/admin/requests
```

---

# Approve Request

## PATCH

```http
/api/admin/requests/:id/approve
```

---

# Reject Request

## PATCH

```http
/api/admin/requests/:id/reject
```

---

# 7. User Management APIs

# Create Client

## POST

```http
/api/admin/users/client
```

---

# Create Notary

## POST

```http
/api/admin/users/notary
```

---

# Upload Verification Documents

## POST

```http
/api/admin/users/:id/documents
```

---

# 8. Order APIs

# Create Order

## POST

```http
/api/orders
```

### Request

```json
{
  "serviceType": "Loan Signing",
  "borrower": {
    "firstName": "Sarah",
    "lastName": "Mitchell"
  },
  "location": {
    "city": "Austin",
    "state": "Texas"
  }
}
```

### Response

```json
{
  "success": true,
  "orderId": "RON-9402",
  "status": "Pending"
}
```

---

# Assign Notary

## PATCH

```http
/api/admin/orders/:id/assign
```

### Request

```json
{
  "notaryId": "123"
}
```

### Response

```json
{
  "success": true,
  "status": "Assigned"
}
```

---

# Get Orders

## GET

```http
/api/orders
```

---

# Mark Order Complete

## PATCH

```http
/api/orders/:id/complete
```

---

# 9. Messaging APIs

# Get Conversation

## GET

```http
/api/conversations/order/:orderId
```

---

# Send Message

## POST

```http
/api/conversations/:id/messages
```

### Request

```json
{
  "message": "Document uploaded",
  "messageType": "text"
}
```

---

# Upload Attachment

## POST

```http
/api/messages/:id/attachments
```

---

# 10. Notification APIs

# Get Notifications

## GET

```http
/api/notifications
```

---

# Mark Notification Read

## PATCH

```http
/api/notifications/:id/read
```

---

# 11. Recommended Folder Structure

```text
src/
 ├── controllers/
 ├── routes/
 ├── services/
 ├── middleware/
 ├── models/
 ├── sockets/
 ├── uploads/
 ├── utils/
 ├── config/
 └── app.js
```

---

# 12. Security Requirements

## Must Have

- JWT Authentication
- Role-based access
- File validation
- Rate limiting
- Password hashing
- HTTPS
- Input validation
- Secure file URLs

---

# 13. Future Scope

## Future Features

- Zoom Integration
- Video Recording
- AI Chat Assistant
- AI Document Review
- E-signature Integration
- Stripe Integration
- Calendar Sync
- SMS Notifications
- Push Notifications
- KBA Automation
- OCR Verification

---

# 14. Flow Control Update — Order Acceptance, Notary Reassignment & Manual Payment

## Order Control Flow

The client creates an order from the frontend/client dashboard. The order appears in the Admin Order Management dashboard with initial status:

```text
Pending Admin Review
```

Admin can then:

```text
Accept Order
Reject Order
```

---

## If Admin Rejects Order

If the admin rejects the order:

- Order status becomes `Rejected`
- Client is notified
- No notary assignment happens
- No payment workflow starts
- Order remains in history/audit logs

---

## If Admin Accepts Order

If the admin accepts the order:

- Order status becomes `Accepted By Admin`
- Admin can assign a verified notary
- Admin chooses payment terms for the notary
- Admin sets notary payout amount or percentage
- Admin sets payout delay, for example 30 days after completion

---

## Notary Assignment Flow

After admin assigns a notary, the notary receives the assignment and can choose:

```text
Accept Assignment
Reject Assignment
```

### If Notary Accepts

- Order status becomes `Assigned` or `Accepted By Notary`
- Notary can begin the work
- Order conversation includes Admin, Client, and Notary
- Notary can complete the signing workflow

### If Notary Rejects

- Order status returns to `Needs Reassignment`
- Admin is notified
- Admin must assign another verified notary
- The rejected notary is removed from the active assignment
- Assignment history is stored in audit logs

---

## Updated Order Status Lifecycle

```text
Pending Admin Review
Accepted By Admin
Rejected By Admin
Notary Assigned
Accepted By Notary
Rejected By Notary
Needs Reassignment
In Progress
Completed
Cancelled
```

---

## Manual Payment System

The platform will not use a payment gateway at this stage.

Payments will be handled manually through bank transfer.

Payment records are still stored in the system for tracking, reporting, and audit purposes.

---

## Payment Decision Rules

The admin controls:

- Total client payment amount
- Notary payout amount
- Admin/company portion
- Notary payment due date
- Payment release delay
- Payment status

Example:

```text
Client pays total: $300
Notary payout: $150
Admin/company keeps: $150
Notary payout release: 30 days after order completion
```

---

## Bank Information Requirement

Each user should have bank information stored securely.

Applies to:

- Client
- Notary
- Admin / Company

Required bank fields:

```json
{
  "accountHolderName": "John Smith",
  "bankName": "Bank of America",
  "bankBranch": "Austin Downtown Branch",
  "routingNumber": "111000025",
  "accountNumber": "1234567890",
  "bankCode": "BOFAUS3N",
  "accountType": "Checking"
}
```

Sensitive bank data must be encrypted or stored using a secure vault/tokenized method.

---

## Payment Collection Flow

```text
Order Created
    ↓
Admin Accepts Order
    ↓
Admin Sets Total Fee + Notary Payout
    ↓
Client Pays Manually by Bank Transfer
    ↓
Admin Marks Client Payment as Received
    ↓
Notary Completes Order
    ↓
Payout Timer Starts
    ↓
Admin Pays Notary Manually
    ↓
Admin Marks Notary Payout as Paid
```

---

## Payment Statuses

```text
Unpaid
Awaiting Bank Transfer
Client Paid
Admin Verified Payment
Notary Payout Pending
Notary Payout Scheduled
Notary Paid
Payment Disputed
Cancelled
```

---

## MongoDB Payment Structure

```json
{
  "_id": "ObjectId",
  "orderId": "ObjectId",
  "clientId": "ObjectId",
  "notaryId": "ObjectId",
  "totalAmount": 300,
  "notaryPayoutAmount": 150,
  "adminRevenue": 150,
  "paymentMethod": "Manual Bank Transfer",
  "clientPaymentStatus": "Client Paid",
  "notaryPayoutStatus": "Payout Pending",
  "payoutReleaseDays": 30,
  "payoutDueDate": "ISODate",
  "clientBankReference": "TXN-123456",
  "adminNotes": "Payment received manually",
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

---

## Additional APIs for Flow Control & Manual Payment

### Admin Accept Order

```http
PATCH /api/admin/orders/:id/accept
```

### Admin Reject Order

```http
PATCH /api/admin/orders/:id/reject
```

### Assign Notary with Payment Terms

```http
PATCH /api/admin/orders/:id/assign-notary
```

Request:

```json
{
  "notaryId": "notaryObjectId",
  "totalAmount": 300,
  "notaryPayoutAmount": 150,
  "payoutReleaseDays": 30,
  "paymentNotes": "Notary will be paid 30 days after completion."
}
```

### Notary Accept Assignment

```http
PATCH /api/notary/orders/:id/accept
```

### Notary Reject Assignment

```http
PATCH /api/notary/orders/:id/reject
```

Request:

```json
{
  "reason": "Not available at this time"
}
```

### Save Bank Information

```http
POST /api/users/bank-info
```

### Update Payment Status Manually

```http
PATCH /api/admin/orders/:id/payment-status
```

Request:

```json
{
  "clientPaymentStatus": "Client Paid",
  "notaryPayoutStatus": "Payout Scheduled",
  "bankReference": "TXN-123456",
  "notes": "Manual transfer confirmed by admin."
}
```

---

# 15. Final Project Scope Summary

# Main Modules

## Authentication System
## User Request System
## Admin Management
## Client Management
## Notary Management
## Order Management
## Assignment System
## Messaging System
## File Upload System
## Payment System
## Audit Logs
## Notification System
## Reporting System

---

# Platform Workflow Summary

```text
User Request
    ↓
Admin Review
    ↓
Verified User Creation
    ↓
Client Creates Order
    ↓
Admin Reviews Order
    ↓
Admin Assigns Notary
    ↓
Conversation Created
    ↓
Notary Accepts Assignment
    ↓
Notary Performs Signing
    ↓
Documents Uploaded
    ↓
Order Completed
    ↓
Audit + Notifications + Payments
```

---

# END OF DOCUMENT

