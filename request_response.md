# Notarix API Request & Response Examples

Base URL: `/api/v1`

---

# 1. Authentication

## POST `/auth/login`

### Request

```json
{
  "email": "client@example.com",
  "password": "TempPassword123"
}
```

### Success Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "passwordResetRequired": true,
    "user": {
      "id": "665f1a100000000000000001",
      "name": "John Client",
      "email": "client@example.com",
      "role": "Client",
      "status": "Active",
      "verified": true
    }
  }
}
```

---

## PATCH `/auth/reset-password`

### Request

```json
{
  "currentPassword": "TempPassword123",
  "newPassword": "NewSecurePassword123"
}
```

### Response

```json
{
  "success": true,
  "message": "Password updated successfully. Please login again."
}
```

---

# 2. User Access Request

## POST `/requests`

### Request

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "companyName": "ABC Title Company",
  "phone": "+1-555-123-4567",
  "contactType": "Company",
  "requestType": "Client",
  "state": "Texas",
  "message": "I want to use the platform for signing orders."
}
```

### Response

```json
{
  "success": true,
  "message": "Request submitted successfully",
  "data": {
    "requestId": "665f1a100000000000000002",
    "status": "Pending"
  }
}
```

---

## GET `/admin/requests?status=Pending`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "665f1a100000000000000002",
      "name": "John Smith",
      "email": "john@example.com",
      "companyName": "ABC Title Company",
      "phone": "+1-555-123-4567",
      "contactType": "Company",
      "requestType": "Client",
      "state": "Texas",
      "status": "Pending",
      "createdAt": "2026-05-25T10:00:00.000Z"
    }
  ]
}
```

---

## PATCH `/admin/requests/:id/reject`

### Request

```json
{
  "reason": "Information could not be verified."
}
```

### Response

```json
{
  "success": true,
  "message": "Request rejected successfully",
  "data": {
    "requestId": "665f1a100000000000000002",
    "status": "Rejected"
  }
}
```

---

# 3. User Management

## POST `/admin/users/client`

### Request

```json
{
  "requestId": "665f1a100000000000000002",
  "organization": {
    "companyName": "ABC Title Company",
    "companyType": "Title Company",
    "website": "https://example.com",
    "phone": "+1-555-123-4567"
  },
  "address": {
    "street": "123 Main Street",
    "city": "Austin",
    "state": "Texas",
    "zip": "73301"
  },
  "primaryContact": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1-555-123-4567"
  },
  "requiredDocuments": [
    {
      "documentType": "Service Agreement",
      "status": "Verified",
      "fileUrl": "https://storage.example.com/service-agreement.pdf"
    },
    {
      "documentType": "W-9",
      "status": "Missing"
    }
  ],
  "loginEmail": "john@example.com",
  "sendInviteEmail": true
}
```

### Response

```json
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "userId": "665f1a100000000000000003",
    "role": "Client",
    "status": "Active",
    "verified": false,
    "passwordResetRequired": true
  }
}
```

---

## POST `/admin/users/notary`

### Request

```json
{
  "requestId": "665f1a100000000000000004",
  "personalInfo": {
    "fullName": "Marcus Webb",
    "email": "marcus@example.com",
    "phone": "+1-555-999-1000",
    "profilePhotoUrl": "https://storage.example.com/profile.jpg"
  },
  "address": {
    "street": "456 Oak Street",
    "city": "Dallas",
    "state": "Texas",
    "zip": "75001"
  },
  "commission": {
    "commissionNumber": "TX-123456",
    "commissionState": "Texas",
    "expirationDate": "2028-12-31",
    "travelRadiusMiles": 50,
    "coverageAreas": ["Dallas County", "Collin County"]
  },
  "requiredDocuments": [
    {
      "documentType": "Commission Certificate",
      "status": "Verified",
      "fileUrl": "https://storage.example.com/commission.pdf"
    },
    {
      "documentType": "E&O Insurance",
      "status": "Verified",
      "fileUrl": "https://storage.example.com/insurance.pdf"
    },
    {
      "documentType": "Background Check",
      "status": "Verified",
      "fileUrl": "https://storage.example.com/background.pdf"
    },
    {
      "documentType": "Government ID",
      "status": "Verified",
      "fileUrl": "https://storage.example.com/id.pdf"
    }
  ],
  "loginEmail": "marcus@example.com",
  "sendInviteEmail": true
}
```

### Response

```json
{
  "success": true,
  "message": "Notary created successfully",
  "data": {
    "userId": "665f1a100000000000000005",
    "role": "Notary",
    "status": "Active",
    "verified": true,
    "passwordResetRequired": true
  }
}
```

---

# 4. Bank Information

## POST `/users/bank-info`

### Request

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

### Response

```json
{
  "success": true,
  "message": "Bank information saved successfully",
  "data": {
    "bankInfoId": "665f1a100000000000000006",
    "accountNumberLast4": "7890",
    "bankName": "Bank of America"
  }
}
```

---

# 5. Orders

## POST `/site/orders`

### Request

```json
{
  "vendorCode": "VC-1001",
  "serviceType": "Loan Signing",
  "signerFirstName": "Sarah",
  "signerLastName": "Mitchell",
  "signerPhone": "+1-555-444-2222",
  "signerEmail": "sarah@example.com",
  "hasSecondarySigner": true,
  "propertyAddress": {
    "line1": "789 Pine Road",
    "city": "Austin",
    "state": "Texas",
    "zip": "73301",
    "timeZone": "America/Chicago"
  },
  "signingDate": "2026-06-01",
  "signingTime": "14:30",
  "feeAmount": 150,
  "paperSize": "Letter",
  "preferredInk": "Blue",
  "estimatedPages": "120",
  "isRon": false,
  "specialInstructions": "Borrower prefers afternoon appointment."
}
```

### Response

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "orderId": "ORD-1779814869049",
    "status": "Pending",
    "workflowStatus": "Pending Admin Review"
  }
}
```

---

## GET `/site/client/orders/:id`

### Response

```json
{
  "success": true,
  "data": {
    "id": "#ORD-1779814869049",
    "rawId": "ORD-1779814869049",
    "client": "Order Client Co",
    "clientEmail": "portal.client@example.com",
    "borrower": "Sarah Mitchell",
    "borrowerEmail": "sarah@example.com",
    "borrowerPhone": "+1-555-444-2222",
    "service": "Loan Signing",
    "status": "Pending",
    "workflowStatus": "Pending Admin Review",
    "propertyAddress": {
      "line1": "789 Pine Road",
      "city": "Austin",
      "state": "Texas",
      "zip": "73301",
      "timeZone": "America/Chicago"
    },
    "documents": [],
    "timeline": [
      {
        "status": "Pending Admin Review",
        "note": "Order submitted by client."
      }
    ]
  }
}
```

---

## PATCH `/admin/orders/:id/accept`

### Response

```json
{
  "success": true,
  "message": "Order accepted successfully.",
  "data": {
    "id": "#ORD-1779814869049",
    "rawId": "ORD-1779814869049",
    "client": "Order Client Co",
    "status": "Accepted By Admin"
  }
}
```

---

## PATCH `/admin/orders/:id/reject`

### Request

```json
{
  "reason": "Missing borrower details."
}
```

### Response

```json
{
  "success": true,
  "message": "Order rejected",
  "data": {
    "orderId": "RON-9402",
    "status": "Rejected By Admin"
  }
}
```

---

## GET `/admin/orders/:id/eligible-notaries`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "notary-1779800000000",
      "name": "Marcus Webb",
      "email": "marcus@example.com",
      "phone": "+1-555-999-1000",
      "location": "Texas",
      "radius": "50",
      "status": "Pending",
      "jobs": "4 verified documents",
      "tags": ["RON"]
    }
  ]
}
```

---

## PATCH `/admin/orders/:id/assign-notary`

### Request

```json
{
  "notaryId": "notary-1779800000000",
  "notaryOfferAmount": 120,
  "payoutReleaseDays": 7,
  "assignmentNotes": "Offer expires if not accepted by end of day."
}
```

### Response

```json
{
  "success": true,
  "message": "Notary assigned successfully",
  "data": {
    "id": "#ORD-1779814869049",
    "rawId": "ORD-1779814869049",
    "status": "Notary Assigned",
    "notaryId": "notary-1779800000000",
    "payment": {
      "feeAmount": 150,
      "notaryOfferAmount": 120,
      "payoutReleaseDays": 7,
      "assignmentNotes": "Offer expires if not accepted by end of day."
    }
  }
}
```

---

# 6. Notary Assignment

## PATCH `/notary/orders/:id/accept`

### Request

```json
{
  "message": "I accept this assignment."
}
```

### Response

```json
{
  "success": true,
  "message": "Assignment accepted",
  "data": {
    "orderId": "RON-9402",
    "status": "Accepted By Notary"
  }
}
```

---

## PATCH `/notary/orders/:id/reject`

### Request

```json
{
  "reason": "I am not available at the signing time."
}
```

### Response

```json
{
  "success": true,
  "message": "Assignment rejected. Admin must assign another notary.",
  "data": {
    "orderId": "RON-9402",
    "status": "Needs Reassignment"
  }
}
```

---

## PATCH `/notary/orders/:id/start`

### Request

```json
{
  "message": "Starting signing process."
}
```

### Response

```json
{
  "success": true,
  "message": "Order started",
  "data": {
    "orderId": "RON-9402",
    "status": "In Progress"
  }
}
```

---

## PATCH `/notary/orders/:id/complete`

### Request

```json
{
  "completionNotes": "Signing completed and documents uploaded."
}
```

### Response

```json
{
  "success": true,
  "message": "Order completed successfully",
  "data": {
    "orderId": "RON-9402",
    "status": "Completed",
    "completedAt": "2026-06-01T18:00:00.000Z",
    "payoutDueDate": "2026-07-01T18:00:00.000Z"
  }
}
```

---

# 7. Messaging

## GET `/conversations/order/:orderId`

### Response

```json
{
  "success": true,
  "data": {
    "conversationId": "665f1a100000000000000008",
    "orderId": "665f1a100000000000000007",
    "participants": [
      {
        "id": "665f1a100000000000000003",
        "name": "John Client",
        "role": "Client"
      },
      {
        "id": "665f1a100000000000000009",
        "name": "Admin User",
        "role": "Admin"
      },
      {
        "id": "665f1a100000000000000005",
        "name": "Marcus Webb",
        "role": "Notary"
      }
    ]
  }
}
```

---

## POST `/conversations/:id/messages`

### Request

```json
{
  "messageType": "text",
  "message": "Hello, I have uploaded the required document."
}
```

### Response

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "messageId": "665f1a100000000000000010",
    "conversationId": "665f1a100000000000000008",
    "messageType": "text",
    "message": "Hello, I have uploaded the required document.",
    "createdAt": "2026-06-01T12:00:00.000Z"
  }
}
```

---

## POST `/messages/:id/attachments`

Content-Type: `multipart/form-data`

### Request Fields

```text
files: [document.pdf, image.png]
```

### Response

```json
{
  "success": true,
  "message": "Attachments uploaded",
  "data": [
    {
      "fileName": "document.pdf",
      "fileType": "application/pdf",
      "fileSize": 250000,
      "fileUrl": "https://storage.example.com/document.pdf"
    }
  ]
}
```

---

# 8. Manual Payment

## PATCH `/admin/orders/:id/payment-status`

### Request

```json
{
  "clientPaymentStatus": "Client Paid",
  "notaryPayoutStatus": "Payout Scheduled",
  "bankReference": "TXN-123456",
  "notes": "Manual bank transfer confirmed by admin."
}
```

### Response

```json
{
  "success": true,
  "message": "Payment status updated",
  "data": {
    "orderId": "RON-9402",
    "clientPaymentStatus": "Client Paid",
    "notaryPayoutStatus": "Payout Scheduled",
    "bankReference": "TXN-123456"
  }
}
```

---

# 9. Notifications

## GET `/notifications`

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "665f1a100000000000000011",
      "title": "New Assignment",
      "message": "You have been assigned to order RON-9402.",
      "read": false,
      "createdAt": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

---

# 10. Standard Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```
