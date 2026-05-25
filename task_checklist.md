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
- [ ] Add required document upload section
- [ ] Mark uploaded documents as Verified
- [ ] Mark missing documents as Missing
- [x] Create client API
- [x] Auto-generate password
- [x] Set passwordResetRequired to true
- [x] Send invite email
- [x] Build client profile page

---

# 6. Notary Management Module

- [ ] Build Add Notary form
- [x] Add personal information fields
- [x] Add address information fields
- [x] Add commission details fields
- [ ] Add travel radius field
- [ ] Add coverage areas field
- [ ] Add notary document upload section
- [ ] Mark uploaded documents as Verified
- [ ] Mark missing documents as Missing
- [x] Create notary API
- [ ] Auto-generate password
- [ ] Set passwordResetRequired to true
- [ ] Send invite email
- [x] Build notary profile page
- [x] Build verified notary filtering logic

---

# 7. Bank Information Module

- [ ] Add bank info fields to user profile
- [ ] Build save bank info API
- [ ] Build update bank info API
- [ ] Build get own bank info API
- [ ] Build admin view bank info API
- [ ] Mask account number in frontend
- [ ] Encrypt sensitive bank data
- [ ] Add bank info validation

---

# 8. Client Order Module

- [ ] Build Create New Order page
- [ ] Add client/vendor information section
- [ ] Add borrower information section
- [ ] Add property details section
- [ ] Add signing date/time section
- [ ] Add service details section
- [ ] Add special instructions field
- [ ] Add order document upload
- [ ] Build create order API
- [ ] Set initial status as Pending Admin Review
- [ ] Notify admin after order creation
- [ ] Build client order list page
- [ ] Build client order detail page

---

# 9. Admin Order Management Module

- [ ] Build Order Management dashboard
- [x] Show total orders
- [x] Show pending orders
- [x] Show assigned orders
- [x] Show in-progress orders
- [x] Show completed orders
- [ ] Build order filters
- [ ] Build order search
- [x] Build admin order details page
- [ ] Build accept order API
- [ ] Build reject order API
- [x] Build eligible notaries API
- [x] Build assign notary API
- [ ] Build reassign notary API
- [ ] Add payment terms while assigning notary
- [ ] Create conversation after notary assignment
- [ ] Notify notary after assignment

---

# 10. Notary Assignment Module

- [ ] Build Notary Assignments dashboard
- [ ] Show pending acceptance orders
- [ ] Show accepted orders
- [ ] Show in-progress orders
- [ ] Show completed orders
- [ ] Build assignment detail page
- [ ] Build accept assignment API
- [ ] Build reject assignment API
- [ ] If rejected, set status to Needs Reassignment
- [ ] Notify admin after rejection
- [ ] Build start order API
- [ ] Build complete order API
- [ ] Build completed document upload API
- [ ] Set payout due date after completion

---

# 11. Order Status Flow

- [ ] Add Pending Admin Review status
- [ ] Add Accepted By Admin status
- [ ] Add Rejected By Admin status
- [ ] Add Notary Assigned status
- [ ] Add Accepted By Notary status
- [ ] Add Rejected By Notary status
- [ ] Add Needs Reassignment status
- [ ] Add In Progress status
- [ ] Add Completed status
- [ ] Add Cancelled status
- [ ] Add audit log for each status change

---

# 12. Messaging Module

- [ ] Create Conversation model
- [ ] Create Message model
- [ ] Create attachment structure
- [ ] Auto-create conversation after notary assignment
- [ ] Add client, admin, and notary as participants
- [ ] Build conversation list API
- [ ] Build order conversation API
- [ ] Build message list API
- [ ] Build send message API
- [ ] Build attachment upload API
- [ ] Build image upload support
- [ ] Build file upload support
- [ ] Add real-time Socket.IO message events
- [ ] Add message read status
- [ ] Restrict access to conversation participants only
- [ ] Keep conversations permanently

---

# 13. Manual Payment Module

- [ ] Create Payment model
- [ ] Store total client payment amount
- [ ] Store notary payout amount
- [ ] Calculate admin/company revenue
- [ ] Store payout release days
- [ ] Store payout due date
- [ ] Build payment terms API
- [ ] Build payment status update API
- [ ] Build bank transfer proof upload API
- [ ] Build admin payment list page
- [ ] Build client payment view
- [ ] Build notary payout view
- [ ] Add payment status filters
- [ ] Add payment audit log
- [ ] Mark client payment as received manually
- [ ] Mark notary payout as paid manually

---

# 14. Notification Module

- [ ] Create Notification model
- [ ] Build get notifications API
- [ ] Build mark read API
- [ ] Build mark all read API
- [ ] Notify admin on new request
- [ ] Notify admin on new order
- [ ] Notify client on order status change
- [ ] Notify notary on assignment
- [ ] Notify admin when notary rejects
- [ ] Notify client/admin when order completed
- [ ] Add real-time notification event

---

# 15. Document Upload Module

- [ ] Setup file upload middleware
- [ ] Validate file types
- [ ] Validate file size
- [ ] Upload user verification documents
- [ ] Upload order documents
- [ ] Upload completed documents
- [ ] Upload message attachments
- [ ] Store file metadata
- [ ] Secure file access by role
- [ ] Add file preview/download support

---

# 16. Audit Log Module

- [ ] Create AuditLog model
- [ ] Log user request approval/rejection
- [ ] Log user creation
- [ ] Log document verification
- [ ] Log order creation
- [ ] Log order acceptance/rejection
- [ ] Log notary assignment
- [ ] Log notary acceptance/rejection
- [ ] Log order completion
- [ ] Log payment status updates
- [ ] Build audit log API
- [ ] Build audit log frontend page

---

# 17. Reports Module

- [ ] Build dashboard stats API
- [ ] Build order report API
- [ ] Build payment report API
- [ ] Build notary performance report
- [ ] Build client activity report
- [ ] Add CSV export for orders
- [ ] Add CSV export for payments
- [ ] Add date range filters

---

# 18. Frontend Pages Checklist

- [ ] Public request page
- [ ] Login page
- [ ] First login password reset page
- [ ] Super Admin dashboard
- [ ] Admin dashboard
- [ ] User management page
- [ ] Add client page
- [ ] Add notary page
- [ ] Admin order management page
- [ ] Admin order detail page
- [ ] Client dashboard
- [ ] Create order page
- [ ] Client order detail page
- [ ] Notary dashboard
- [ ] Notary assignment list page
- [ ] Notary assignment detail page
- [ ] Conversation/chat page
- [ ] Payment page
- [ ] Reports page
- [ ] Audit logs page
- [ ] Profile settings page
- [ ] Bank information page

---

# 19. Security Checklist

- [ ] Password hashing with bcrypt
- [ ] JWT authentication
- [ ] Refresh token rotation
- [ ] Role-based authorization
- [ ] Input validation
- [ ] File type validation
- [ ] File size limits
- [ ] Secure file URLs
- [ ] Rate limiting
- [ ] CORS setup
- [ ] Helmet security headers
- [ ] Bank info encryption
- [ ] Environment variable protection
- [ ] Error logging
- [ ] Prevent access to other users' conversations
- [ ] Prevent access to other users' orders

---

# 20. Final Testing Checklist

- [ ] Test client request flow
- [ ] Test notary request flow
- [ ] Test admin approval flow
- [ ] Test client creation
- [ ] Test notary creation
- [ ] Test first login reset
- [ ] Test client order creation
- [ ] Test admin order acceptance
- [ ] Test admin order rejection
- [ ] Test notary assignment
- [ ] Test notary rejection and reassignment
- [ ] Test notary acceptance
- [ ] Test order completion
- [ ] Test conversation creation
- [ ] Test messaging with files/images
- [ ] Test manual payment tracking
- [ ] Test bank info saving
- [ ] Test notifications
- [ ] Test audit logs
- [ ] Test reports
- [ ] Test role restrictions
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
