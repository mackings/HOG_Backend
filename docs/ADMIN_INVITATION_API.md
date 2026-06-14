# Admin Invitation API

Base URL:

```text
https://hog-fyic.onrender.com/api/v1
```

## Flow

1. An existing administrator submits an invitation.
2. The backend creates a verified privileged account with a generated temporary password.
3. The invited person receives an email containing their email, temporary password, role,
   responsibilities, and login link.
4. They log in using the emailed credentials.
5. They replace the temporary password.
6. Privileged APIs become available after the password change.

The temporary password is never returned by the invitation API.

## Authorization

| Inviter | Can invite `admin` | Can invite `superAdmin` |
| --- | --- | --- |
| `admin` | Yes | No |
| `superAdmin` | Yes | Yes |
| Other roles | No | No |

All invitation requests require:

```http
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

## Send Invitation

```http
POST /api/v1/admin/invitations
```

### Request

Required fields:

- `fullName`
- `email`
- `role`: `admin` or `superAdmin`

Optional fields:

- `phoneNumber`
- `country`: defaults to `Nigeria`
- `address`: defaults to `Administrative account`
- `responsibilities`: up to 10 custom responsibility descriptions

```json
{
  "fullName": "Ada Platform Manager",
  "email": "ada.admin@example.com",
  "role": "admin",
  "phoneNumber": "+2348000000000",
  "country": "Nigeria",
  "address": "Lagos, Nigeria",
  "responsibilities": [
    "Review and moderate marketplace listings",
    "Monitor users and successful transactions",
    "Resolve day-to-day administration issues"
  ]
}
```

When `responsibilities` is omitted, the backend supplies defaults for the selected role.

### Success Response

`201 Created`

```json
{
  "success": true,
  "message": "Admin invitation sent successfully",
  "data": {
    "user": {
      "_id": "685000000000000000000101",
      "fullName": "Ada Platform Manager",
      "email": "ada.admin@example.com",
      "role": "admin",
      "isVerified": true,
      "mustChangePassword": true,
      "invitedBy": "685000000000000000000001",
      "invitedAt": "2026-06-14T12:30:00.000Z"
    },
    "responsibilities": [
      "Review and moderate marketplace listings",
      "Monitor users and successful transactions",
      "Resolve day-to-day administration issues"
    ],
    "credentialsDeliveredByEmail": true
  }
}
```

For a super-admin invitation, use:

```json
{
  "fullName": "Platform Owner Two",
  "email": "owner.two@example.com",
  "role": "superAdmin"
}
```

Only an authenticated `superAdmin` can submit that request.

## Invitation Email

The email contains:

- Invited person's name and email
- Generated 16-character temporary password
- `Admin` or `Super Admin` role
- Default or custom responsibilities
- Login link based on `FRONTEND_URL`
- Instruction to change the temporary password

If email delivery fails, the API deletes the newly created account and returns `502`.
This prevents an inaccessible privileged account from remaining in the database.

## First Login

```http
POST /api/v1/user/login
```

```json
{
  "email": "ada.admin@example.com",
  "password": "<temporary-password-from-email>"
}
```

Example `200 OK` response:

```json
{
  "message": "Login successful. You must change your temporary password.",
  "token": "<jwt-access-token>",
  "user": {
    "_id": "685000000000000000000101",
    "fullName": "Ada Platform Manager",
    "email": "ada.admin@example.com",
    "role": "admin",
    "isVerified": true,
    "mustChangePassword": true
  },
  "passwordChangeRequired": true
}
```

Role-protected APIs return `403` until the password is changed:

```json
{
  "message": "You must change your temporary password before accessing this resource",
  "code": "PASSWORD_CHANGE_REQUIRED"
}
```

## Change Temporary Password

```http
PUT /api/v1/user/changeTemporaryPassword
```

Headers:

```http
Authorization: Bearer <token-returned-by-login>
Content-Type: application/json
```

Request:

```json
{
  "currentPassword": "<temporary-password-from-email>",
  "newPassword": "NewSecurePassword9!",
  "confirmPassword": "NewSecurePassword9!"
}
```

Success response:

```json
{
  "message": "Password changed successfully",
  "passwordChangeRequired": false
}
```

The new password must:

- Be at least 8 characters
- Match `confirmPassword`
- Be different from the temporary password

The existing JWT remains valid after the change.

## Error Responses

Missing required invitation fields:

```json
{
  "success": false,
  "message": "Full name, email, and role are required"
}
```

Existing account:

```json
{
  "success": false,
  "message": "An account with this email already exists"
}
```

Admin attempting to invite a super admin:

```json
{
  "success": false,
  "message": "Only a superAdmin can invite another superAdmin"
}
```

Email delivery failure:

```json
{
  "success": false,
  "message": "Invitation email could not be delivered. No account was created."
}
```

Incorrect temporary password during password replacement:

```json
{
  "message": "Current password is incorrect"
}
```

## Mail Configuration

The API uses Mailjet when these are configured:

```text
MAILJET_API_KEY
MAILJET_API_SECRET
MAILJET_FROM_EMAIL
MAILJET_FROM_NAME
```

Otherwise it falls back to SMTP:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
```

The email login button uses:

```text
FRONTEND_URL
```

## Security Behavior

- Public `/user/register` accepts only `user` and `tailor` roles.
- `admin` and `superAdmin` accounts can only be created through this authenticated API.
- Passwords are stored as bcrypt hashes.
- Temporary passwords are generated with cryptographically secure randomness.
- Invitation credentials are sent only by email and are not returned in API responses.
- Privileged role middleware blocks invited accounts until the password is replaced.
- Invitation audit fields are stored as `invitedBy` and `invitedAt`.
