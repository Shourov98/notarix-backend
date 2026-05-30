# Notarix Development Task Checklist

Use this checklist to track project completion.

---

# 1. Project Setup

- [x] Create frontend project
- [x] Create backend project
- [x] Setup MongoDB connection
- [x] Setup environment variables
- [x] Setup API base structure
- [x] Setup error handler middleware
- [x] Setup validation middleware
- [x] Setup file upload storage
- [x] Setup role-based middleware
- [x] Setup Socket.IO server

---

# 2. Authentication Module

- [x] Create User model
- [x] Create password hashing service
- [x] Create JWT access token service
- [x] Create refresh token service
- [x] Build login API
- [x] Build logout API
- [x] Build refresh token API
- [x] Build first-login password reset API
- [x] Build forgot password API
- [x] Build current user API
- [x] Protect routes by authentication
- [x] Protect routes by role

---

# 3. User Request Module

- [x] Create UserRequest model
- [x] Build public access request form
- [x] Build submit request API
- [x] Set default status as Pending
- [x] Build admin request list page
- [x] Build request details page
- [x] Build approve request API
- [x] Build reject request API
- [x] Send admin notification after new request
- [x] Send user notification/email after approval or rejection

---

# 4. Admin & Super Admin Module

- [x] Build Super Admin dashboard
- [x] Build Admin dashboard
- [x] Build admin creation API
- [x] Build admin management page
- [x] Build user table with filters
- [x] Build user status update API
- [x] Build suspend/activate user API
- [x] Build user detail view
- [x] Build user search and pagination

---

# 5. Client Management Module

- [x] Build Add Client form
- [x] Add organization information fields
- [x] Add address fields
- [x] Add primary contact fields
- [x] Add secondary contact fields
- [x] Add required document upload section
- [x] Mark uploaded documents as Verified
- [x] Mark missing documents as Missing
- [x] Create client API
- [x] Auto-generate password
- [x] Set passwordResetRequired to true
- [x] Send invite email
- [x] Build client profile page

---

# 6. Notary Management Module

- [x] Build Add Notary form
- [x] Add personal information fields
- [x] Add address information fields
- [x] Add commission details fields
- [x] Add travel radius field
- [x] Add coverage areas field
- [x] Add notary document upload section
- [x] Mark uploaded documents as Verified
- [x] Mark missing documents as Missing
- [x] Create notary API
- [x] Auto-generate password
- [x] Set passwordResetRequired to true
- [x] Send invite email
- [x] Build notary profile page
- [x] Build verified notary filtering logic

---

# 7. Bank Information Module

- [x] Add bank info fields to user profile
- [x] Build save bank info API
- [x] Build update bank info API
- [x] Build get own bank info API
- [x] Build admin view bank info API
- [x] Mask account number in frontend
- [x] Encrypt sensitive bank data
- [x] Add bank info validation

---

# 8. Client Order Module

- [x] Build Create New Order page
- [x] Add client/vendor information section
- [x] Add borrower information section
- [x] Add property details section
- [x] Add signing date/time section
- [x] Add service details section
- [x] Add special instructions field
- [x] Add order document upload
- [x] Build create order API
- [x] Set initial status as Pending Admin Review
- [x] Notify admin after order creation
- [x] Build client order list page
- [x] Build client order detail page

---

# 9. Admin Order Management Module

- [x] Build Order Management dashboard
- [x] Show total orders
- [x] Show pending orders
- [x] Show assigned orders
- [x] Show in-progress orders
- [x] Show completed orders
- [x] Build order filters
- [x] Build order search
- [x] Build admin order details page
- [x] Build accept order API
- [x] Build reject order API
- [x] Build eligible notaries API
- [x] Build assign notary API
- [x] Build reassign notary API
- [x] Add payment terms while assigning notary
- [x] Create conversation after notary assignment
- [x] Notify notary after assignment

---

# 10. Notary Assignment Module

- [x] Build Notary Assignments dashboard
- [x] Show pending acceptance orders
- [x] Show accepted orders
- [x] Show in-progress orders
- [x] Show completed orders
- [x] Build assignment detail page
- [x] Build accept assignment API
- [x] Build reject assignment API
- [x] If rejected, set status to Needs Reassignment
- [x] Notify admin after rejection
- [x] Build start order API
- [x] Build complete order API
- [x] Build completed document upload API
- [x] Set payout due date after completion

---

# 11. Order Status Flow

- [x] Add Pending Admin Review status
- [x] Add Accepted By Admin status
- [x] Add Rejected By Admin status
- [x] Add Notary Assigned status
- [x] Add Accepted By Notary status
- [x] Add Rejected By Notary status
- [x] Add Needs Reassignment status
- [x] Add In Progress status
- [x] Add Completed status
- [x] Add Cancelled status
- [x] Add audit log for each status change

---

# 12. Messaging Module

- [x] Create Conversation model
- [x] Create Message model
- [x] Create attachment structure
- [x] Auto-create conversation after notary assignment
- [x] Add client, admin, and notary as participants
- [x] Build conversation list API
- [x] Build order conversation API
- [x] Build message list API
- [x] Build send message API
- [x] Build attachment upload API
- [x] Build image upload support
- [x] Build file upload support
- [x] Add real-time Socket.IO message events
- [x] Add message read status
- [x] Restrict access to conversation participants only
- [x] Keep conversations permanently

---

# 13. Manual Payment Module

- [x] Create Payment model
- [x] Store total client payment amount
- [x] Store notary payout amount
- [x] Calculate admin/company revenue
- [x] Store payout release days
- [x] Store payout due date
- [x] Build payment terms API
- [x] Build payment status update API
- [x] Build bank transfer proof upload API
- [x] Build admin payment list page
- [x] Build client payment view
- [x] Build notary payout view
- [x] Add payment status filters
- [x] Add payment audit log
- [x] Mark client payment as received manually
- [x] Mark notary payout as paid manually

---

# 14. Notification Module

- [x] Create Notification model
- [x] Build get notifications API
- [x] Build mark read API
- [x] Build mark all read API
- [x] Notify admin on new request
- [x] Notify admin on new order
- [x] Notify client on order status change
- [x] Notify notary on assignment
- [x] Notify admin when notary rejects
- [x] Notify client/admin when order completed
- [x] Add real-time notification event

---

# 15. Document Upload Module

- [x] Setup file upload middleware
- [x] Validate file types
- [x] Validate file size
- [x] Upload user verification documents
- [x] Upload order documents
- [x] Upload completed documents
- [x] Upload message attachments
- [x] Store file metadata
- [x] Secure file access by role
- [x] Add file preview/download support

---

# 16. Audit Log Module

- [x] Create AuditLog model
- [x] Log user request approval/rejection
- [x] Log user creation
- [x] Log document verification
- [x] Log order creation
- [x] Log order acceptance/rejection
- [x] Log notary assignment
- [x] Log notary acceptance/rejection
- [x] Log order completion
- [x] Log payment status updates
- [x] Build audit log API
- [x] Build audit log frontend page

---

# 17. Reports Module

- [x] Build dashboard stats API
- [x] Build order report API
- [x] Build payment report API
- [x] Build notary performance report
- [x] Build client activity report
- [x] Add CSV export for orders
- [x] Add CSV export for payments
- [x] Add date range filters

---

# 18. Frontend Pages Checklist

- [x] Public request page
- [x] Login page
- [x] First login password reset page
- [x] Super Admin dashboard
- [x] Admin dashboard
- [x] User management page
- [x] Add client page
- [x] Add notary page
- [x] Admin order management page
- [x] Admin order detail page
- [x] Client dashboard
- [x] Create order page
- [x] Client order detail page
- [x] Notary dashboard
- [x] Notary assignment list page
- [x] Notary assignment detail page
- [x] Conversation/chat page
- [x] Payment page
- [x] Reports page
- [x] Audit logs page
- [x] Profile settings page
- [x] Bank information page

---

# 19. Security Checklist

- [x] Password hashing with bcrypt
- [x] JWT authentication
- [x] Refresh token rotation
- [x] Role-based authorization
- [x] Input validation
- [x] File type validation
- [x] File size limits
- [x] Secure file URLs
- [x] Rate limiting
- [x] CORS setup
- [x] Helmet security headers
- [x] Bank info encryption
- [x] Environment variable protection
- [x] Error logging
- [x] Prevent access to other users' conversations
- [x] Prevent access to other users' orders

---

# 20. Final Testing Checklist

- [x] Test client request flow
- [x] Test notary request flow
- [x] Test admin approval flow
- [x] Test client creation
- [x] Test notary creation
- [x] Test first login reset
- [x] Test client order creation
- [x] Test admin order acceptance
- [x] Test admin order rejection
- [x] Test notary assignment
- [x] Test notary rejection and reassignment
- [x] Test notary acceptance
- [x] Test order completion
- [x] Test conversation creation
- [x] Test messaging with files/images
- [x] Test manual payment tracking
- [x] Test bank info saving
- [x] Test notifications
- [x] Test audit logs
- [x] Test reports
- [x] Test role restrictions
- [ ] Test production deployment

---

# 21. Deployment Checklist

- [ ] Setup production MongoDB
- [ ] Setup production file storage
- [ ] Setup backend hosting
- [ ] Setup frontend hosting
- [ ] Setup environment variables
- [ ] Setup SSL/HTTPS
- [ ] Setup email service
- [ ] Setup logging service
- [ ] Setup backup strategy
- [ ] Test production API
- [ ] Test production frontend
- [ ] Final admin account creation
