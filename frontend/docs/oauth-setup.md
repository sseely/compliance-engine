# OAuth Provider Setup Guide

This guide walks you through setting up OAuth providers for the OIDC verification dashboard.

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (or Google People API for newer projects)

### 2. Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth 2.0 Client IDs**
3. If prompted, configure the OAuth consent screen first:
   - Choose **External** for testing
   - Fill in required fields:
     - App name: "Compliance Engine OIDC Testing"
     - User support email: your email
     - Developer contact: your email
   - Add test users if needed

### 3. Configure OAuth Client

1. Choose **Web application** as the application type
2. Set the name: "Compliance Engine Local Development"
3. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/auth/callback/google
   ```
4. Click **Create**
5. Copy the **Client ID** (you won't need the client secret for this flow)

### 4. Update Environment Variables

Update your `.env.local` file:

```bash
# Replace the placeholder with your actual Google Client ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com
```

### 5. Test the Integration

1. Restart your development server: `npm run dev`
2. Navigate to `http://localhost:3000/admin/auth-verification`
3. Log in as a platform admin
4. Click "Test Google Login" - it should now open a Google OAuth popup
5. Complete the Google authentication flow
6. The popup should close and show the verification result

## Microsoft Azure AD Setup

### 1. Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: "Compliance Engine OIDC Testing"
   - **Account types**: Select "Accounts in any organizational directory and personal Microsoft accounts (personal Microsoft accounts, e.g. Skype, Xbox)"
   - **Redirect URI**: Select **Web** and enter: `http://localhost:3000/auth/callback/microsoft`
5. Click **Register**

### 2. Configure Additional Settings

After registration:

1. **Copy the Application (client) ID** from the Overview page
2. Go to **Authentication** tab:
   - Ensure redirect URI is correct: `http://localhost:3000/auth/callback/microsoft`
   - Under **Implicit grant and hybrid flows**, check:
     - ✅ **Access tokens (used for implicit flows)**
     - ✅ **ID tokens (used for implicit and hybrid flows)**
3. Go to **API permissions** tab:
   - Verify these permissions are included:
     - `User.Read` (should be there by default)
     - `openid`
     - `profile`
     - `email`
   - If missing, click **Add a permission** > **Microsoft Graph** > **Delegated permissions**

### 3. Update Environment Variables

```bash
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your-actual-azure-application-id
```

### 4. Test the Integration

1. Restart your development server: `npm run dev`
2. Navigate to `http://localhost:3000/admin/auth-verification`
3. The Microsoft button should now show "Test Microsoft Login" instead of "OAuth Not Configured"
4. Click "Test Microsoft Login" - it should open Microsoft OAuth popup
5. Complete the Microsoft authentication flow
6. The popup should close and show verification result

## LinkedIn OAuth Setup

### 1. Create LinkedIn App

1. Go to [LinkedIn Developers](https://developer.linkedin.com/)
2. Click **Create app**
3. Fill in app details:
   - **App name**: "Compliance Engine OIDC Testing"
   - **LinkedIn Page**: Select your company page (or create one)
   - **App logo**: Upload a logo (optional)
   - **Legal agreement**: Check the agreement box
4. Click **Create app**

### 2. Configure OAuth Settings

1. Go to the **Auth** tab
2. Add **Authorized redirect URLs**:
   ```
   http://localhost:3000/auth/callback/linkedin
   ```
3. Under **Products**, request access to:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn** (if needed)

### 3. Update Environment Variables

```bash
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your-linkedin-client-id
```

**Note**: LinkedIn OAuth may require app review for production use. For development/testing, the basic setup should work.

## Apple Sign In Setup

### 1. Apple Developer Prerequisites

- **Apple Developer Account** (paid membership required - $99/year)
- **App ID** configured for Sign In with Apple

### 2. Create App ID (if not exists)

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** > **App IDs**
4. Click **+** to register a new App ID
5. Configure:
   - **Description**: "Compliance Engine"
   - **Bundle ID**: `com.yourcompany.compliance-engine`
   - **Capabilities**: Check ✅ **Sign In with Apple**

### 3. Create Service ID

1. Go to **Identifiers** > **Services IDs**
2. Click **+** to register a new Service ID
3. Configure:
   - **Description**: "Compliance Engine Web Auth"
   - **Identifier**: `com.yourcompany.compliance-engine.web`
4. Click **Continue** and **Register**
5. Click on your new Service ID to configure it
6. Check ✅ **Sign In with Apple**
7. Click **Configure** next to Sign In with Apple
8. Configure domains and return URLs:
   - **Primary App ID**: Select your App ID from step 2
   - **Domains and Subdomains**: `localhost` (for dev), `yourdomain.com` (for prod)
   - **Return URLs**: `http://localhost:3000/auth/callback/apple`

### 4. Update Environment Variables

```bash
NEXT_PUBLIC_APPLE_ID=com.yourcompany.compliance-engine.web
```

**Important Notes:**
- Apple Sign In uses **form_post** response mode, sending data via POST
- Full implementation requires server-side handling of POST callbacks
- The current implementation shows the client-side structure but may need backend completion
- Apple enforces strict domain verification for production use

## Security Notes

### Production Considerations

1. **Client Secrets**: The current implementation uses the implicit flow for simplicity. In production, implement the authorization code flow with a backend to securely handle client secrets.

2. **HTTPS Required**: OAuth providers require HTTPS in production. Update redirect URIs to use your production domain.

3. **Environment Variables**: Never commit real OAuth credentials to version control. Use secure environment variable management in production.

### Development vs Production URLs

**Development:**
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Production:**
```bash
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com
```

Make sure to update OAuth provider redirect URIs when deploying to production.

## Troubleshooting

### Common Issues

1. **"OAuth not configured" message**: Verify the client ID is set in `.env.local` and doesn't contain "test" in the value.

2. **Popup blocked**: Allow popups for localhost in your browser settings.

3. **Redirect URI mismatch**: Ensure the redirect URI in your OAuth provider settings exactly matches the one in the application.

4. **CORS errors**: This usually indicates a misconfigured redirect URI or client ID.

### Testing Multiple Providers

You can set up and test multiple providers simultaneously. Each provider's configuration is independent, so you can configure Google first, test it, then add Microsoft, etc.

## Implementation Details

The OAuth implementation includes:

- **Security**: State parameter validation to prevent CSRF attacks
- **User Experience**: Popup-based flow that doesn't disrupt the main application
- **Error Handling**: Comprehensive error messages for debugging
- **Timeout Handling**: 5-minute timeout for OAuth flows
- **Result Tracking**: Verification results are stored in the database with user email and metadata