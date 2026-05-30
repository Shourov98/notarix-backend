# Notarix API Request & Response Examples

Base URL: `/api/v1`

---

# 1. Authentication

## POST `/admin/auth/login`

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
    "uid": "admin-1717000000000",
    "email": "admin@notarix.io",
    "role": "super_admin",
    "is_verified": true,
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token",
    "expires_in": 43200
  }
}
```

---

## POST `/site/auth/login`

### Request

```json
{
  "email": "client@example.com",
  "password": "TempPassword123",
  "role": "client"
}
```

### Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "uid": "client-1717000000000",
    "email": "client@example.com",
    "role": "Client",
    "status": "Active",
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token",
    "expires_in": 43200,
    "passwordResetRequired": true
  }
}
```

---

## PATCH `/site/auth/reset-password`

### Request

```json
{
  "new_password": "NewSecurePassword123"
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

## PATCH `/site/client/bank-info`

### Request

```json
{
  "accountHolderName": "John Smith",
  "bankName": "Bank of America",
  "routingNumber": "111000025",
  "accountNumber": "1234567890",
  "accountType": "checking"
}
```

### Response

```json
{
  "success": true,
  "message": "Bank info updated successfully.",
  "data": {
    "bankName": "Bank of America",
    "accountHolderName": "John Smith",
    "accountType": "checking",
    "routingNumber": "*****0025",
    "accountNumber": "******7890"
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

## GET `/conversations`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "conv-1780119204143-d82b2eda",
      "orderId": "ORD-1780119202820",
      "title": "Messaging Client Co · Jordan Miles",
      "lastMessageAt": "2026-05-30T09:06:46.127Z",
      "lastMessagePreview": "Admin attachment upload verification.",
      "participants": [
        {
          "actorId": "adm-001",
          "actorType": "admin",
          "role": "super_admin",
          "name": "Alexander Sterling",
          "email": "admin@notarix.io"
        },
        {
          "actorId": "usr-client-001",
          "actorType": "user",
          "role": "Client",
          "name": "Client Contact",
          "email": "msg.client.1780119202820@example.com"
        },
        {
          "actorId": "usr-notary-001",
          "actorType": "user",
          "role": "Notary",
          "name": "Messaging Notary",
          "email": "msg.notary.1780119202820@example.com"
        }
      ],
      "counterpart": {
        "name": "Client Contact",
        "role": "Client",
        "email": "msg.client.1780119202820@example.com"
      }
    }
  ]
}
```

---

## GET `/conversations/order/:orderId`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "conv-1780119204143-d82b2eda",
    "orderId": "ORD-1780119202820",
    "title": "Messaging Client Co · Jordan Miles",
    "lastMessageAt": "2026-05-30T09:06:46.127Z",
    "lastMessagePreview": "Admin attachment upload verification.",
    "participants": [
      {
        "actorId": "usr-client-001",
        "actorType": "user",
        "name": "Client Contact",
        "role": "Client"
      },
      {
        "actorId": "adm-001",
        "actorType": "admin",
        "name": "Alexander Sterling",
        "role": "super_admin"
      },
      {
        "actorId": "usr-notary-001",
        "actorType": "user",
        "name": "Messaging Notary",
        "role": "Notary"
      }
    ],
    "counterpart": {
      "name": "Client Contact",
      "role": "Client",
      "email": "msg.client.1780119202820@example.com"
    }
  }
}
```

---

## GET `/conversations/:id/messages`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "conversation": {
      "id": "conv-1780119204143-d82b2eda",
      "orderId": "ORD-1780119202820",
      "title": "Messaging Client Co · Jordan Miles"
    },
    "messages": [
      {
        "id": "msg-1780119205691-d9786c31",
        "conversationId": "conv-1780119204143-d82b2eda",
        "orderId": "ORD-1780119202820",
        "senderId": "adm-001",
        "senderRole": "super_admin",
        "senderName": "Alexander Sterling",
        "body": "Admin live message for verification.",
        "attachments": [],
        "createdAt": "2026-05-30T09:06:45.693Z",
        "isOwnMessage": true,
        "isRead": true,
        "readBy": [
          {
            "actorId": "adm-001",
            "actorType": "admin",
            "readAt": "2026-05-30T09:06:45.692Z"
          }
        ]
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
  "body": "Hello, I have uploaded the required document."
}
```

### Response

```json
{
  "success": true,
  "message": "Message sent successfully.",
  "data": {
    "id": "msg-1780119205691-d9786c31",
    "conversationId": "conv-1780119204143-d82b2eda",
    "orderId": "ORD-1780119202820",
    "senderId": "adm-001",
    "senderRole": "super_admin",
    "senderName": "Alexander Sterling",
    "body": "Hello, I have uploaded the required document.",
    "attachments": [],
    "createdAt": "2026-05-30T09:06:45.693Z",
    "isOwnMessage": true,
    "isRead": true,
    "readBy": [
      {
        "actorId": "adm-001",
        "actorType": "admin",
        "readAt": "2026-05-30T09:06:45.692Z"
      }
    ]
  }
}
```

---

## POST `/conversations/:id/attachments`

Content-Type: `multipart/form-data`

### Request Fields

```text
attachments: [sample.png, sample.pdf]
body: Admin attachment upload verification.
```

### Response

```json
{
  "success": true,
  "message": "Attachments uploaded successfully.",
  "data": {
    "id": "msg-1780119206125-36b9ab10",
    "conversationId": "conv-1780119204143-d82b2eda",
    "orderId": "ORD-1780119202820",
    "senderId": "adm-001",
    "senderRole": "super_admin",
    "senderName": "Alexander Sterling",
    "body": "Admin attachment upload verification.",
    "attachments": [
      {
        "id": "att-1780119206120-1ccdfc50",
        "name": "sample.png",
        "url": "/uploads/1748596012094-sample.png",
        "mimeType": "image/png",
        "size": 67,
        "kind": "image"
      },
      {
        "id": "att-1780119206121-8f1d5f8d",
        "name": "sample.pdf",
        "url": "/uploads/1748596012095-sample.pdf",
        "mimeType": "application/pdf",
        "size": 54,
        "kind": "file"
      }
    ],
    "createdAt": "2026-05-30T09:06:46.127Z",
    "isOwnMessage": true,
    "isRead": true,
    "readBy": [
      {
        "actorId": "adm-001",
        "actorType": "admin",
        "readAt": "2026-05-30T09:06:46.126Z"
      }
    ]
  }
}
```

---

## PATCH `/messages/:id/read`

### Response

```json
{
  "success": true,
  "message": "Message marked as read.",
  "data": {
    "id": "msg-1780119206125-36b9ab10",
    "conversationId": "conv-1780119204143-d82b2eda",
    "orderId": "ORD-1780119202820",
    "senderId": "adm-001",
    "senderRole": "super_admin",
    "senderName": "Alexander Sterling",
    "body": "Admin attachment upload verification.",
    "attachments": [
      {
        "id": "att-1780119206120-1ccdfc50",
        "name": "sample.png",
        "url": "/uploads/1748596012094-sample.png",
        "mimeType": "image/png",
        "size": 67,
        "kind": "image"
      }
    ]
  }
}
```

---

# 8. Manual Payment

## GET `/admin/payments`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "summary": {
      "totalClientRevenue": 210,
      "totalNotaryPayouts": 110,
      "totalCompanyRevenue": 100,
      "pendingInbound": 0,
      "pendingOutbound": 0
    },
    "payments": [
      {
        "id": "pay-ORD-1780120651222-notary",
        "paymentId": "pay-ORD-1780120651222",
        "orderId": "#ORD-1780120651222",
        "direction": "Outbound",
        "counterpartyName": "Payment Notary",
        "amountLabel": "$110.00",
        "status": "Paid",
        "method": "ACH",
        "target": "notary"
      }
    ]
  }
}
```

---

## PATCH `/admin/orders/:id/payment-terms`

### Request

```json
{
  "totalClientAmount": 210,
  "notaryPayoutAmount": 110,
  "payoutReleaseDays": 6,
  "clientPaymentMethod": "Bank Transfer",
  "clientDueDate": "2026-06-18",
  "notes": "Updated manual payment terms"
}
```

### Response

```json
{
  "success": true,
  "message": "Payment terms updated successfully.",
  "data": {
    "orderId": "ORD-1780120651222",
    "totalClientAmount": 210,
    "notaryPayoutAmount": 110,
    "companyRevenueAmount": 100
  }
}
```

---

## PATCH `/admin/orders/:id/payment-status`

### Request

```json
{
  "target": "client",
  "status": "Received",
  "method": "Bank Transfer",
  "transactionReference": "CLI-1780120651222",
  "notes": "Manual bank transfer confirmed by admin.",
  "paidDate": "2026-06-18"
}
```

### Response

```json
{
  "success": true,
  "message": "Payment status updated successfully.",
  "data": {
    "orderId": "RON-9402",
    "clientPayment": {
      "status": "Received",
      "method": "Bank Transfer",
      "transactionReference": "CLI-1780120651222"
    }
  }
}
```

---

## POST `/admin/orders/:id/payment-proof`

Content-Type: `multipart/form-data`

### Request Fields

```text
target: client
proof: payment-proof.pdf
```

### Response

```json
{
  "success": true,
  "message": "Payment proof uploaded successfully.",
  "data": {
    "orderId": "ORD-1780120651222",
    "clientPayment": {
      "proof": {
        "name": "payment-proof.pdf",
        "url": "/uploads/1780120659227-payment-proof.pdf",
        "mimeType": "application/pdf"
      }
    }
  }
}
```

---

## GET `/site/client/payments`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "summary": {
      "totalOrderValue": 210,
      "totalPaid": 210,
      "pending": 0
    },
    "records": [
      {
        "orderId": "#ORD-1780120651222",
        "amountLabel": "$210.00",
        "status": "Received"
      }
    ]
  }
}
```

---

## GET `/site/notary/payments`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "summary": {
      "totalEarned": 110,
      "totalPaid": 110,
      "pending": 0
    },
    "records": [
      {
        "orderId": "#ORD-1780120651222",
        "amountLabel": "$110.00",
        "status": "Paid"
      }
    ]
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

Notification real-time event:

```text
Socket event: new_notification
```

---

# 10. Secure Files

## GET `/files/orders/:orderId/documents/:documentId?mode=view`

Returns the uploaded file inline for authorized actors only.

## GET `/files/orders/:orderId/documents/:documentId?mode=download`

Returns the same file with download disposition for authorized actors only.

The same `mode=view|download` pattern is supported for:

- `/files/users/:userId/avatar`
- `/files/users/:userId/documents/:documentId`
- `/files/orders/:orderId/completed-documents/:documentId`
- `/files/conversations/:conversationId/attachments/:attachmentId`
- `/files/payments/:orderId/:target/proof`

---

# 11. Audit Logs

## GET `/admin/audit-logs`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "audit-1780122878702-a91fe2c1",
      "action": "order.accepted",
      "entityType": "order",
      "entityId": "ORD-1780122876436",
      "actorId": "admin-123",
      "actorRole": "super_admin",
      "title": "Order accepted",
      "summary": "ORD-1780122876436 accepted by admin.",
      "createdAt": "2026-05-30T06:34:38.702Z"
    }
  ]
}
```

---

## GET `/admin/reports/dashboard-stats?dateFrom=2026-01-01&dateTo=2026-12-31`

### Response

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "summary": {
      "totalOrders": 24,
      "completedOrders": 12,
      "activeOrders": 5,
      "pendingOrders": 7,
      "totalRevenue": 3140,
      "totalPayouts": 1915,
      "totalProfit": 1225,
      "totalClients": 6,
      "totalNotaries": 5
    },
    "revenueSeries": [
      {
        "label": "MAY",
        "value": 3140
      }
    ],
    "ordersByStatus": [
      {
        "status": "Completed",
        "count": 12
      }
    ],
    "paymentMethods": [
      {
        "method": "ACH",
        "amount": 1080
      }
    ]
  }
}
```

---

## GET `/admin/reports/orders?dateFrom=2026-01-01&dateTo=2026-12-31&format=csv`

### Response

Content-Type: `text/csv`

```csv
orderId,createdAt,clientName,clientCompany,serviceType,signerName,status,notaryName,feeAmount,city,state,signingDate,signingTime
ORD-1717000000000,2026-05-30T06:00:00.000Z,Checklist Client,Checklist Closings,Loan Signing,Jamie Accepted,Completed,Checklist Notary,180,Raleigh,NC,2026-06-15,14:30
```

---

# 12. Standard Error Response

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
