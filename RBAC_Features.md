# Role-Based Access Control (RBAC) Features

## Overview

The AIonOS RFP Solution Generator implements a comprehensive Role-Based Access Control (RBAC) system to manage user authentication, authorization, and data access across the application. The system ensures secure access to features and data based on user roles and permissions.

---

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Role Definitions](#role-definitions)
3. [Protected Routes](#protected-routes)
4. [Backend Authorization](#backend-authorization)
5. [Data Access Control](#data-access-control)
6. [Session Management](#session-management)
7. [API Security](#api-security)
8. [User Identification](#user-identification)

---

## Authentication System

### Frontend Authentication

The application uses a session-based authentication mechanism implemented in the frontend:

- **Session Storage**: User authentication state is stored in browser `sessionStorage`
- **Authentication Key**: `aionos_auth` flag indicates authenticated status
- **User Data**: User email and role are stored in session storage
- **Login Component**: Located in `frontend/src/pages/Login.js`

### Authentication Flow

1. User enters credentials on the login page
2. Credentials are validated against the system
3. Upon successful authentication:
   - `aionos_auth` is set to `'1'`
   - `aionos_user_email` stores the user's email
   - `aionos_user_role` stores the user's role
4. User is redirected to the dashboard
5. Authentication state persists across page refreshes (until session ends)

### Logout Mechanism

- Users can logout from the dashboard or header
- Logout clears all session storage items
- Custom event `aionos:logout` is dispatched for cross-component coordination
- Users are redirected to the login page

---

## Role Definitions

The system currently supports two primary roles:

### 1. Admin Role
- **Identifier**: `admin`
- **Access Level**: Standard user access
- **Data Visibility**: Can only view and manage their own generated solutions
- **Use Case**: Individual users who generate and manage their own proposals

### 2. Manager Role
- **Identifier**: `manager`
- **Access Level**: Elevated access with cross-user visibility
- **Data Visibility**: Can view and manage solutions created by both Manager and Admin users
- **Use Case**: Team leads or supervisors who need oversight of team-generated proposals

### Role Storage

Roles are stored in:
- Frontend: `sessionStorage.getItem('aionos_user_role')`
- Backend: Determined by user email identifier

---

## Protected Routes

### Frontend Route Protection

The application uses a `ProtectedRoute` component to guard sensitive routes:

**Location**: `frontend/src/App.js`

**Protected Routes**:
- `/dashboard` - User dashboard
- `/rfp` - RFP Solution Generator
- `/tenders` - Active Tenders browser
- `/wishlist` - User wishlist management

**Public Routes**:
- `/` - Home page
- `/home` - Home page
- `/login` - Login page
- `/contact` - Contact page
- `/logout` - Logout redirect

### Protection Mechanism

```javascript
const ProtectedRoute = ({ authed, redirectPath = '/login' }) => {
  if (!authed) {
    return <Navigate to={redirectPath} replace />;
  }
  return <Outlet />;
};
```

- Unauthenticated users are automatically redirected to `/login`
- Authenticated users can access all protected routes
- Route protection is enforced at the React Router level

---

## Backend Authorization

### User Identification Header

The backend uses the `X-User-Email` HTTP header to identify the requesting user:

- **Header Name**: `X-User-Email`
- **Purpose**: Identifies the authenticated user making the request
- **Source**: Extracted from frontend session storage
- **Validation**: Required for all protected endpoints

### Authorization Pattern

Backend endpoints use FastAPI's `Header` dependency to extract user identity:

```python
async def endpoint_name(
    x_user_email: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    requester = (x_user_email or "").strip()
    if not requester:
        raise HTTPException(status_code=403, detail="Unauthorized")
    # Role-based access control logic
```

---

## Data Access Control

### Solution Access Rules

The system implements hierarchical access control for generated solutions:

#### Admin Users
- **Can Access**: Only solutions where `user_id` matches their email
- **Cannot Access**: Solutions created by other users (including Manager)
- **Implementation**: Direct email matching filter

#### Manager Users
- **Can Access**: Solutions where `user_id` is either:
  - Their own email (`Manager@gmail.com`)
  - Admin email (`Admin@gmail.com`)
- **Cannot Access**: Solutions created by other users
- **Implementation**: `IN` clause filter with both emails

#### Other Users
- **Can Access**: Only solutions where `user_id` matches their email
- **Cannot Access**: Solutions created by any other user
- **Implementation**: Direct email matching filter

### API Endpoints with Access Control

#### 1. Get Solutions List
**Endpoint**: `GET /api/solutions`

**Access Control**:
- Requires `X-User-Email` header
- Returns filtered list based on user role
- Manager sees Admin + Manager solutions
- Others see only their own

**Implementation**: `backend/main.py` (lines 2048-2081)

#### 2. Get Specific Solution
**Endpoint**: `GET /api/solutions/{solution_id}`

**Access Control**:
- Requires `X-User-Email` header
- Validates user has permission to access the solution
- Returns 403 Forbidden if access denied
- Returns 404 if solution not found

**Implementation**: `backend/main.py` (lines 2083-2109)

#### 3. Save Solution
**Endpoint**: `POST /api/solutions`

**Access Control**:
- Requires `X-User-Email` header
- Associates solution with user via `user_id` field
- Stores user email for future access control

**Implementation**: `backend/main.py` (lines 1990-2018)

### Uploaded Solutions Access Control

**Endpoint**: `GET /api/uploaded-solutions`

**Access Control**:
- Uses `X-User-ID` header (alternative to `X-User-Email`)
- Returns only solutions uploaded by the requesting user
- Each uploaded solution is tagged with `user_id`

**Implementation**: `backend/upload_routes.py`

### Wishlist Access Control

**Endpoint**: `GET /api/wishlists`

**Access Control**:
- Uses global user ID from session
- Returns only wishlist items created by the current user
- Implements soft-delete filtering (excludes removed items)

**Implementation**: `backend/wishlist_routes.py`

---

## Session Management

### Session Storage Keys

The application uses the following session storage keys:

| Key | Purpose | Example Value |
|-----|---------|---------------|
| `aionos_auth` | Authentication flag | `'1'` (authenticated) or `null` |
| `aionos_user_email` | User email identifier | `'Admin@gmail.com'` |
| `aionos_user_role` | User role | `'admin'` or `'manager'` |

### Session Lifecycle

1. **Login**: All session keys are set
2. **Active Session**: Keys persist across page navigation
3. **Page Refresh**: Authentication state is restored from session storage
4. **Logout**: All session keys are cleared
5. **Session Expiry**: Browser session ends when tab/window closes

### Session Security Considerations

- Session data is stored client-side in browser session storage
- Data is cleared when browser session ends
- No server-side session management (stateless backend)
- User email is sent with each API request via header

---

## API Security

### Header-Based Authentication

All protected API endpoints require the `X-User-Email` header:

```python
x_user_email: Optional[str] = Header(None)
```

### Authorization Checks

1. **Header Validation**: Ensures `X-User-Email` is present and non-empty
2. **Role-Based Filtering**: Applies role-specific access rules
3. **Data Filtering**: Database queries filter by `user_id` based on role
4. **Error Responses**:
   - `403 Forbidden`: User lacks permission
   - `401 Unauthorized`: Missing or invalid authentication
   - `404 Not Found`: Resource doesn't exist or user can't access it

### Security Best Practices

- User identity is extracted from headers, not request body
- Database queries use parameterized filters (SQLAlchemy ORM)
- Access control is enforced at the API layer
- Solutions are associated with user IDs at creation time

---

## User Identification

### User ID Format

- **Format**: Email address
- **Examples**: `Admin@gmail.com`, `Manager@gmail.com`
- **Storage**: Stored in database `user_id` column
- **Uniqueness**: Email serves as unique identifier

### User ID Usage

1. **Solution Association**: Each solution is tagged with creator's email
2. **Access Control**: Email determines what solutions user can access
3. **API Requests**: Email sent in `X-User-Email` header
4. **Database Queries**: Filtered by `user_id` column

---

## Database Schema

### Solution Table

The `Solution` table includes user identification:

- **`user_id`**: String column storing user email
- **Purpose**: Associates each solution with its creator
- **Indexing**: Used for filtering queries
- **Access Control**: Primary field for RBAC enforcement

### Uploaded Solution Table

Similar structure for uploaded solutions:

- **`user_id`**: String column storing user email
- **Purpose**: Associates uploaded documents with users
- **Access Control**: Ensures users only see their uploads

---

## Frontend-Backend Integration

### Request Flow

1. **Frontend**: Extracts user email from `sessionStorage.getItem('aionos_user_email')`
2. **API Call**: Includes email in `X-User-Email` header
3. **Backend**: Extracts email from header
4. **Authorization**: Applies role-based access rules
5. **Response**: Returns filtered data based on permissions

### Example API Call

```javascript
const email = sessionStorage.getItem('aionos_user_email');
const response = await fetch('/api/solutions', {
  headers: {
    'X-User-Email': email
  }
});
```

---

## Access Control Matrix

| User Role | Own Solutions | Admin Solutions | Manager Solutions | Other Users' Solutions |
|-----------|---------------|-----------------|-------------------|----------------------|
| **Admin** | ✅ View | ✅ View | ❌ No Access | ❌ No Access |
| **Manager** | ✅ View | ✅ View | ✅ View | ❌ No Access |
| **Other** | ✅ View | ❌ No Access | ❌ No Access | ❌ No Access |

---

## Future Enhancements

### Potential RBAC Improvements

1. **Additional Roles**: Support for more granular roles (Viewer, Editor, etc.)
2. **Permission System**: Fine-grained permissions (read, write, delete, share)
3. **Team Management**: Group-based access control
4. **Resource Sharing**: Ability to share solutions with specific users
5. **Audit Logging**: Track access and modifications
6. **Token-Based Auth**: JWT tokens for stateless authentication
7. **Role Hierarchy**: More complex role inheritance
8. **Time-Based Access**: Temporary access grants

---

## Implementation Files

### Frontend Files
- `frontend/src/App.js` - Route protection and authentication state
- `frontend/src/pages/Login.js` - Authentication logic and role assignment
- `frontend/src/pages/Dashboard.js` - User dashboard with role display
- `frontend/src/components/GeneratedSolutions.jsx` - Solution list with access control

### Backend Files
- `backend/main.py` - Solution endpoints with RBAC (lines 1990-2109)
- `backend/upload_routes.py` - Uploaded solution access control
- `backend/wishlist_routes.py` - Wishlist access control
- `backend/database.py` - Database schema with user_id fields

---

## Security Notes

### Current Implementation
- Client-side session management
- Header-based user identification
- Role-based data filtering
- Database-level access control

### Security Considerations
- Session storage is accessible via JavaScript (XSS risk)
- No server-side session validation
- User email in headers (should use tokens in production)
- Consider implementing JWT or OAuth2 for production use

---

## Summary

The RBAC system provides:

✅ **Role-Based Access**: Admin and Manager roles with different permissions  
✅ **Route Protection**: Frontend routes guarded by authentication  
✅ **Data Isolation**: Users can only access authorized solutions  
✅ **Session Management**: Persistent authentication across page refreshes  
✅ **API Security**: Header-based user identification and authorization  
✅ **Scalable Design**: Foundation for additional roles and permissions  

The system ensures that users can only access data they are authorized to view, maintaining data privacy and security across the application.

