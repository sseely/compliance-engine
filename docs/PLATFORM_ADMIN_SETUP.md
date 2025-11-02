# Platform Admin Setup Guide

This guide explains how to initialize and manage platform administrators for the Compliance Engine.

## Initial Setup

### 1. Environment Configuration

Set these environment variables during initial deployment:

```bash
# Required: Email of the first platform admin
INITIAL_PLATFORM_ADMIN_EMAIL=admin@compliance-engine.com

# Optional: Name of the first platform admin
INITIAL_PLATFORM_ADMIN_NAME="Platform Administrator"
```

### 2. Database Migration

Run the platform admin migrations:

```bash
# Run the migration to create platform admin tables
psql $DATABASE_URL -f backend/migrations/002_create_platform_admins.sql
```

### 3. Application Startup

When the application starts up, it will automatically:
1. Check if any platform admins exist
2. If none exist, create the initial admin using the environment variables
3. Log the initialization status

## Platform Admin vs Customer Admin

### Platform Admins
- **Who**: Compliance Engine employees
- **Access**: Global platform data across all customers
- **Responsibilities**: 
  - View language request analytics
  - Manage platform-wide features
  - Create/deactivate other platform admins
  - Monitor platform health and usage

### Customer Admins  
- **Who**: Admin users within customer organizations
- **Access**: Only their organization's data
- **Responsibilities**:
  - Manage their organization's users
  - View their compliance reports
  - Configure organization settings

## API Endpoints

### Platform Admin Authentication

```bash
# Login (creates session token)
POST /api/v1/platform-admin/login
{
  "email": "admin@compliance-engine.com"
}

# Get current admin info
GET /api/v1/platform-admin/me
Authorization: Bearer <session_token>
```

### Platform Admin Management

```bash
# List all platform admins
GET /api/v1/platform-admin/admins
Authorization: Bearer <session_token>

# Create new platform admin
POST /api/v1/platform-admin/admins
Authorization: Bearer <session_token>
{
  "email": "new-admin@compliance-engine.com",
  "name": "New Admin Name"
}

# Deactivate a platform admin
PUT /api/v1/platform-admin/admins/{admin_id}/deactivate
Authorization: Bearer <session_token>
```

### Protected Analytics Endpoints

```bash
# View language request summary (Platform Admin Only)
GET /api/v1/analytics/language-requests/summary
Authorization: Bearer <session_token>
```

## Security Notes

1. **Session-based Authentication**: Platform admins use session tokens that expire after 24 hours
2. **Self-service Protection**: Admins cannot deactivate themselves
3. **Audit Trail**: All admin actions are logged with timestamps and actor information
4. **Session Cleanup**: Expired sessions are automatically cleaned up
5. **Production SSO**: In production, integrate with your SSO provider (Okta, Auth0, etc.)

## Production Deployment Checklist

- [ ] Set `INITIAL_PLATFORM_ADMIN_EMAIL` environment variable
- [ ] Run database migrations
- [ ] Verify initial admin was created in logs
- [ ] Test platform admin login
- [ ] Create additional platform admins as needed
- [ ] Integrate with production SSO system
- [ ] Set up monitoring for admin actions

## Troubleshooting

### No Initial Admin Created
Check logs for initialization errors and verify:
- `INITIAL_PLATFORM_ADMIN_EMAIL` is set
- Database migrations have run successfully
- Database connection is working

### Cannot Access Analytics
Verify:
- You're using a valid platform admin session token
- Token hasn't expired (24 hour limit)
- Admin account is still active

### Adding New Platform Admins
Only existing platform admins can create new ones. If you need to bootstrap additional admins:
1. Use the existing admin account to create new ones via API
2. Or manually insert into the database (not recommended for production)

## Development vs Production

### Development
- Simple email-based authentication for convenience
- Self-contained session management
- Environment variable initialization

### Production Recommendations
- Integrate with enterprise SSO (Okta, Azure AD, etc.)
- Use shorter session timeouts
- Enable 2FA requirements
- Set up audit logging alerts
- Regular security reviews of admin accounts