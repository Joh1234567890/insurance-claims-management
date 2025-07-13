# Insurance Claim Management System

A comprehensive, production-ready insurance claim management application with advanced workflow automation, audit trails, notifications, and admin controls.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**: JWT-based auth with client/admin roles
- **Claim Management**: Full CRUD operations with status workflows
- **File Upload System**: Multi-file upload with document type validation
- **Admin Review System**: File flagging, comments, and approval workflows

### Advanced Workflow Engine
- **Mandatory Submitted Status**: Admins must mark claims as "submitted" before processing or rejecting
- **Automatic Status Transitions**: Smart workflow based on claim completeness
- **Claim Submission**: Automated validation of required documents
- **Resubmission Workflow**: Admin can request file resubmission with reasons
- **Payment Processing**: Integrated payment workflow for approved claims
- **Completeness Checking**: Real-time validation of claim requirements

### Admin Workflow Process
1. **Review Pending Claims**: Admins review claims in "pending" status
2. **Mark as Submitted**: Admins must mark complete claims as "submitted" before processing
3. **Process or Reject**: Only "submitted" claims can be approved for processing or rejected
4. **Payment Processing**: Approved claims move to "processing" status for payment

### Comprehensive Audit Trail
- **Activity Logging**: Every action is logged with user, timestamp, and details
- **Audit Reports**: Filterable audit logs with export functionality
- **Compliance Ready**: Full audit trail for regulatory compliance
- **Security Monitoring**: Track all system activities and user actions

### Real-time Notifications
- **In-App Notifications**: Real-time notification system for all users
- **Status Updates**: Automatic notifications for claim status changes
- **File Alerts**: Notifications for flagged files and resubmission requests
- **Admin Notifications**: New claim alerts and system updates

### Advanced Admin Features
- **Bulk Operations**: Select and process multiple claims simultaneously
- **Advanced Filtering**: Filter claims by status, date, and other criteria
- **Export Functionality**: Export audit logs and claim data
- **Quick Actions**: One-click approval and rejection workflows

### Enhanced Security
- **Input Validation**: Comprehensive validation for all inputs
- **File Security**: Secure file upload with type and size validation
- **Rate Limiting**: Protection against abuse and DDoS
- **CORS Protection**: Secure cross-origin resource sharing

## 🏗️ Architecture

### Backend (Node.js/Express)
```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── middleware/
│   ├── auth.js             # JWT authentication
│   ├── errorHandler.js     # Error handling
│   └── upload.js          # File upload handling
├── models/
│   └── audit.js           # Audit trail model
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── claims.js          # Claim management
│   ├── files.js           # File operations
│   ├── workflow.js        # Workflow engine
│   ├── notifications.js   # Notification system
│   └── audit.js          # Audit trail access
├── services/
│   ├── workflow.js        # Workflow engine logic
│   └── notification.js    # Notification service
├── utils/
│   └── validation.js      # Input validation
└── server.js             # Main server file
```

### Frontend (React)
```
frontend/src/
├── components/
│   ├── Login.js           # Login component
│   ├── Register.js        # Registration
│   ├── Dashboard.js       # Client dashboard
│   ├── AdminDashboard.js  # Admin dashboard
│   ├── CreateClaim.js     # Claim creation
│   ├── ClaimDetail.js     # Claim details & workflow
│   ├── Notifications.js   # Notification center
│   └── AuditTrail.js      # Audit trail viewer
├── contexts/
│   └── AuthContext.js     # Authentication context
└── App.js                # Main app component
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or cloud instance)
- npm or yarn

### Backend Setup
```bash
cd backend
npm install
cp env.example .env
# Edit .env with your configuration
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Environment Configuration
Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/insurance_claims

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## 📊 Database Schema

### Collections
- **users**: User accounts and authentication
- **claims**: Insurance claims with metadata
- **audit_logs**: Complete audit trail
- **notifications**: User notifications

### Key Features
- **Audit Trail**: Every action logged with full context
- **File Management**: Secure file storage with metadata
- **Status Workflow**: Automated status transitions
- **Notification System**: Real-time user notifications

## 🔄 Workflow States

### Claim Status Flow
1. **Pending**: Initial state, documents being uploaded
2. **Submitted**: All required documents uploaded, ready for review
3. **Processing**: Admin approved, under processing
4. **Paid**: Claim approved and payment processed
5. **Rejected**: Claim rejected with detailed reason
6. **Withdrawn**: Client withdrew the claim

### File Requirements
- Driver's License
- Vehicle Registration
- Insurance Policy
- Police Report
- Repair Estimate

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (client/admin)
- Secure password hashing with bcrypt
- Token expiration and refresh

### File Security
- File type validation (PDF, JPG, PNG, TXT)
- File size limits (10MB default)
- Secure file storage with unique naming
- Virus scanning integration ready

### API Security
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS protection
- Helmet.js security headers

## 📱 User Interface

### Client Features
- **Dashboard**: View all claims with status indicators
- **Claim Creation**: Step-by-step claim creation with file uploads
- **File Management**: Upload, replace, and manage documents
- **Notifications**: Real-time updates and alerts
- **Workflow Actions**: Submit claims and handle resubmissions

### Admin Features
- **Admin Dashboard**: Overview of all claims with filtering
- **Bulk Operations**: Process multiple claims simultaneously
- **Audit Trail**: Complete system activity monitoring
- **Advanced Controls**: File flagging, approval, and rejection
- **Export Functionality**: Export data for reporting

## 🚀 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Claims
- `GET /api/claims` - List claims (filtered by role)
- `POST /api/claims` - Create new claim
- `GET /api/claims/:id` - Get claim details
- `PUT /api/claims/:id/status` - Update claim status
- `PUT /api/claims/:id/reject` - Reject claim
- `PUT /api/claims/:id/withdraw` - Withdraw claim

### Files
- `POST /api/files/:claimId/upload` - Upload files
- `POST /api/files/:claimId/:documentType/upload` - Upload specific document
- `PUT /api/files/:claimId/:fileId/replace` - Replace flagged file
- `PUT /api/files/:claimId/:fileId/flag` - Flag file
- `PUT /api/files/:claimId/:fileId/unflag` - Unflag file

### Workflow
- `POST /api/workflow/submit/:id` - Submit claim for review
- `POST /api/workflow/resubmit/:id` - Resubmit files
- `POST /api/workflow/approve/:id` - Approve claim
- `POST /api/workflow/request-resubmission/:id` - Request resubmission
- `POST /api/workflow/process-payment/:id` - Process payment
- `GET /api/workflow/completeness/:id` - Check claim completeness

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/unread-count` - Get unread count

### Audit Trail
- `GET /api/audit/logs` - Get audit logs (admin only)
- `GET /api/audit/claim/:id` - Get claim audit trail
- `GET /api/audit/export` - Export audit logs (admin only)

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 📈 Performance & Scalability

### Optimizations
- **Database Indexing**: Optimized queries with proper indexes
- **File Streaming**: Efficient file upload and download
- **Caching**: Ready for Redis integration
- **Pagination**: Large dataset handling

### Scalability Features
- **Microservices Ready**: Modular architecture for scaling
- **Load Balancing**: Stateless design for horizontal scaling
- **Database Sharding**: MongoDB ready for sharding
- **CDN Integration**: File serving through CDN

## 🔧 Development

### Code Quality
- **ESLint**: Code linting and formatting
- **Prettier**: Consistent code formatting
- **TypeScript Ready**: Easy migration to TypeScript
- **Documentation**: Comprehensive API documentation

### Development Tools
- **Hot Reload**: Development server with auto-reload
- **Debug Mode**: Detailed error logging
- **Environment Management**: Separate dev/prod configs
- **Database Seeding**: Sample data for development

## 🚀 Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure secure JWT secret
- [ ] Set up MongoDB production instance
- [ ] Configure file storage (S3/Cloud Storage)
- [ ] Set up SSL/TLS certificates
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📋 Compliance & Regulations

### Audit Requirements
- **Complete Audit Trail**: Every action logged
- **Data Retention**: Configurable retention policies
- **Access Logs**: User access and activity tracking
- **Export Capabilities**: Regulatory reporting ready

### Security Compliance
- **Data Encryption**: At rest and in transit
- **Access Controls**: Role-based permissions
- **Input Validation**: XSS and injection protection
- **File Security**: Malware scanning ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

---

**Insurance Claim Management System** - A production-ready solution for modern insurance companies. 