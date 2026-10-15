---
title: Authentication
description: Configure password, Google, Apple, OpenID Connect and SMS-code sign-in, two-step verification, sessions, and running a makerspace without member accounts.
sidebar:
  order: 2
---

Space Works offers four kinds of sign-in: **password**, **identity provider** (Google, Apple, or your
own OpenID Connect server such as Keycloak or Authentik), **SMS code**, and **self sign-up** for new
members. This page explains how to set each one up, which decisions are deployment-wide and which
are per makerspace, and how sessions and two-step verification work.

## Deployment-wide or per makerspace?

Sign-in happens before anyone has chosen a makerspace, so **sign-in providers are configured once
for the whole deployment** by a superadmin. Makerspaces then decide whether they run a member
community at all.

| Setting | Scope | Where |
| --- | --- | --- |
| Which kinds of sign-in are allowed | Deployment | `/control/` → **Platform login methods** |
| Google and Apple client IDs | Deployment | Staff console → **Platform settings** → **Google and Apple sign-in** (or `/control/`) |
| OpenID Connect providers | Deployment | `/control/` → **OIDC providers** |
| SMS provider (Twilio) | Deployment | `/control/` → **Platform SMS settings** |
| Member self sign-up, member area, phone and Google/Apple for members | Per makerspace | The **Member accounts** module (`member_accounts`), see [Modules](/guides/modules/) |
| Require two-step verification for staff | Per makerspace | The **Require MFA for staff** feature (`security.staff_mfa_required`) |

`/control/` is the superadmin control plane. It is deliberately not served on the public website
port; see [Security](/configure/security/#control-plane-access).

## Login method switches

**`/control/` → Platform login methods** has four independent switches: password, identity
provider, phone code and self sign-up. All four are **on** by default. Each switch is an extra
condition in front of the method's own configuration, so turning one on never makes an unconfigured
method appear, and turning one off never deletes stored credentials.

- **Password** covers staff and member password sign-in, and also mobile-app device sign-in.
- **Identity provider** covers Google, Apple and every OpenID Connect provider at once.
- **Phone** covers SMS-code sign-in.
- **Self sign-up** covers creating a new account, including a brand-new account through an identity
  provider. Signing in to, or linking a provider to, an existing account keeps working.

Existing sessions are not ended when you switch a method off; use the restrict or suspend flow to
end someone's access. Space Works refuses two changes because they cannot be undone from inside the
app: switching off a method that is somebody's only way in, and switching off passwords while no
superadmin has a linked identity provider.

## Password sign-in

Password sign-in works out of the box. Passwords must pass Django's standard checks: at least eight
characters, not too similar to the user name, not a common password, and not entirely numeric.

Protections that are always on:

- **Lockout.** Five failed attempts for the same IP address and user name lock that pair out for an
  hour (`AXES_FAILURE_LIMIT`). Failures from other IPs cannot lock an account out.
- **Rate limit.** The sign-in endpoint allows 10 attempts a minute per IP (`THROTTLE_LOGIN`).
- **First superadmin.** `setup_instance` creates the first superadmin with a generated password
  that must be changed at first sign-in.

**Forgot password** appears on the sign-in screen only when email can actually be delivered. Set up
[Email](/configure/email/) and `PUBLIC_APP_BASE_URL`, otherwise the reset link in the email is a bare
path that cannot be clicked.

## Google

Google sign-in uses Google's ID-token button. Space Works stores only the client IDs; there is no
client secret to protect.

1. In the Google Cloud console, create an **OAuth client ID** of type **Web application**.
2. Under **Authorized JavaScript origins**, add every origin people sign in from, for example
   `https://makerspace.example.org` (and any custom domain or shared staff site).
3. Copy the client ID into **Platform settings → Google and Apple sign-in → Web client ID**. For the
   mobile apps, also add the iOS and Android client IDs.

You can also set it from the command line, which is handy right after install:

```bash title="In the install directory"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py configure_social_auth --google-web-client-id "<your-client-id>"
```

Use `--clear` to remove the Google client IDs and hide the button.

## Apple

1. In your Apple Developer account, create a **Services ID** with **Sign in with Apple** enabled.
2. Register your site's domain and its origin (for example `https://makerspace.example.org`) as a
   return URL. The web button opens Apple in a pop-up and returns to the page's origin.
3. In **Platform settings → Google and Apple sign-in**, enter the **Web Service ID**, **Team ID**,
   **Key ID** and paste the **Apple private key (.p8)**. The key is stored encrypted and never shown
   again; leave the field blank later to keep it. For the mobile apps, list their bundle IDs under
   **Native app audiences**, one per line.

## OpenID Connect (Keycloak, Authentik, Azure AD, Okta)

Any standards-compliant OpenID Connect provider can be added. Space Works acts as a **public client**
using the authorization-code flow with PKCE (`S256`), so no client secret is stored. It requests the
scopes `openid email profile`.

:::note
On the web, OpenID Connect buttons appear on the **member** sign-in screens. Staff sign in with a
password or Google/Apple.
:::

### Register Space Works with your provider

Create a client in your identity provider with these properties:

- **Client type:** public, no client secret. In Keycloak, turn **Client authentication** off; in
  Authentik, choose a **Public** client type. For Azure AD and Okta, use an app registration that can
  redeem an authorization code with PKCE and no secret, as described in your provider's
  documentation.
- **Redirect URIs:** the exact member sign-in pages your members use. The redirect URI is the page
  the button was clicked on, so register each one, for example:
  - `https://makerspace.example.org/member` on a makerspace's own domain
  - `https://spaces.example.org/m/<slug>/member` on a shared site
  - `https://makerspace.example.org/member/account`, where members link a provider to an
    existing account
- Redirect URIs must use `https` (only `localhost` may use `http`), and their origin must be one
  Space Works trusts: listed in `CORS_ALLOWED_ORIGINS` or `PLATFORM_STAFF_ORIGINS`, or a verified
  custom domain.

### Add the provider in Space Works

In `/control/` → **OIDC providers**, add a row:

| Field | Value |
| --- | --- |
| Slug | Short identifier, for example `keycloak`. It becomes part of the stored identity (`oidc:keycloak`), so do not change it later. |
| Display name | Button label, for example "University login". |
| Issuer | The exact `iss` value, `https` only. For Keycloak: `https://sso.example.org/realms/<realm>`. Compared character for character, including any trailing slash. |
| JWKS URL | The provider's signing keys, for example `https://sso.example.org/realms/<realm>/protocol/openid-connect/certs`. |
| Client ID | The client ID from your provider. |
| Enabled | On. |
| Allow auto-link | Leave on only if your provider verifies email ownership. |

Space Works fetches `<issuer>/.well-known/openid-configuration` and refuses the provider if the
document's issuer does not match exactly. Providers can be disabled but not deleted, because deleting
one would lock out everyone who signs in only through it.

### How accounts are matched

A provider identity is linked to one Space Works account. On first sign-in with a matching email
address, Space Works links it automatically only when **Allow auto-link** is on, the provider says the
email is verified, **and** the local account's email is verified. Otherwise the person must link the
provider from their account page. A linked identity never grants a role by itself; roles still come
from each makerspace.

## SMS code sign-in

Members can sign in with a one-time code sent to a phone number they have verified. Staff cannot:
an SMS code is too weak for accounts with staff powers.

In `/control/` → **Platform SMS settings**, choose **Twilio**, enter the **Account SID**, **Auth
token** and **From number**, and tick **Enabled**. The auth token is stored encrypted.

:::note
Phone sign-in is an API feature in this release: the endpoints under `/api/v1/auth/phone/` let a
member link and verify a number, then sign in with a code. The bundled website does not yet show a
phone sign-in form, so it is used by the mobile apps and custom clients. See
[API authentication](/api/authentication/).
:::

Numbers must be entered in international E.164 form, for example `+919876543210`. Every text costs
you money, so sending is capped at 200 codes a day across the deployment (`OTP_SMS_DAILY_CAP`), and
requests and guesses are rate limited per IP and per number. While no SMS provider is configured, the
option simply does not appear.

## Two-step verification (TOTP)

Space Works supports authenticator-app codes (TOTP) as a second step:

| Who | Requirement |
| --- | --- |
| Superadmins | Always required. `/control/` is reached through a second-step check at `/mfa/control/`. |
| Staff | Required when any makerspace they work in turns on **Require MFA for staff**. |
| Members | Optional; they enrol from `/mfa`. |

Password, identity-provider, phone and mobile sign-in all return a short-lived challenge
(`MFA_CHALLENGE_TTL_SECONDS`, five minutes by default) before any session is issued. Ten one-time
recovery codes are shown once at enrolment. Authenticator secrets are encrypted with
`API_CLIENT_ENC_KEY`.

If a superadmin loses their authenticator, an operator with server access can reset it. This signs
them out everywhere and forces a fresh enrolment; it does not bypass two-step verification:

```bash title="In the install directory"
scripts/spaceworks-compose.sh bundled run --rm --no-deps backend --role management \
  python manage.py recover_superadmin <username> --reset-mfa
```

## Sessions

| Item | Value |
| --- | --- |
| Access token | 15 minutes, sent as `Authorization: Bearer` |
| Refresh token | 7 days, rotated on every use; the old one is revoked |
| Where the refresh token lives | An `HttpOnly` cookie named `refresh_token`, scoped to `/api/v1/auth/` |

The cookie defaults to `SameSite=None; Secure` so a frontend and API on different origins work.
Refresh and sign-out also require an allowed `Origin` and a custom header, which blocks cross-site
requests.

:::caution[Use HTTPS]
Browsers drop `Secure` cookies on plain HTTP, and Space Works refuses refresh requests from any plain
`http://` origin other than `localhost`. On a plain-HTTP install reached by LAN address or domain,
staff sign-in cannot be renewed, so people are signed out when the 15-minute access token expires or
the page reloads. Serve Space Works over HTTPS for anything beyond a trial on the server itself; see
[Domains and TLS](/install/domains-and-tls/).
:::

Changing a password or two-step settings invalidates older access, refresh and device sessions.
Restricted and suspended accounts are refused on every request; see
[Security](/configure/security/#account-restriction).

## Running without member accounts

A makerspace can run with the **Member accounts** module off. Nobody can sign themselves up, and the
member area, phone sign-in and the Google/Apple buttons for members disappear. Staff sign-in is never
affected.

People can still be named in two ways:

- **Your own OpenID Connect provider** keeps working for members, because it is your institution's
  directory rather than an account system that Space Works runs.
- **Walk-ins.** Front-desk staff add a person at the counter from the handout screen. This creates a
  person record (name, optional email and phone) with no password and no way to sign in. Every path
  that could give that record a password, such as forgot-password, is refused.

Who may submit borrow requests is a separate per-makerspace choice: members, any signed-in account
holder, or (opt-in) anyone without an account. Setup asks it, and you can change it later with
`manage.py set_request_access`. See [Loans](/guides/loans/) and
[Membership](/guides/membership/).

## Next steps

- [Email](/configure/email/): needed for password reset and verification
- [Security](/configure/security/): lockout, rate limits and the control plane
- [Roles and permissions](/guides/roles-and-permissions/)
