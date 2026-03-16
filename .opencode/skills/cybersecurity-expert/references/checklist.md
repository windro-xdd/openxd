# Systematic Security Testing Checklist

Use this checklist methodically. Don't skip steps. Don't rush.

---

## Phase 0: Scope & Rules of Engagement
- [ ] Confirm authorized targets (domains, IPs, apps)
- [ ] Read program policy (out-of-scope, safe harbor, exclusions)
- [ ] Note testing restrictions (no DoS, no social engineering, no physical)
- [ ] Check for VDP vs paid bounty
- [ ] Review past disclosures / hacktivity for duplicate avoidance
- [ ] Set up isolated testing environment (VPN, separate browser profile)

---

## Phase 1: Reconnaissance
### Passive
- [ ] Subdomain enumeration (crt.sh, subfinder, amass, SecurityTrails)
- [ ] DNS records (A, AAAA, CNAME, MX, TXT, NS, SOA)
- [ ] ASN/IP range identification
- [ ] Google dorking (site:, filetype:, inurl:, intitle:)
- [ ] GitHub/GitLab dorking (org repos, leaked secrets)
- [ ] Wayback Machine URL harvesting
- [ ] Social media / LinkedIn OSINT (tech stack clues)
- [ ] Job postings (reveal tech stack, internal tools)
- [ ] Certificate transparency logs
- [ ] Shodan / Censys search

### Active
- [ ] Port scan (full TCP, top UDP)
- [ ] Service detection and version fingerprinting
- [ ] Web technology fingerprinting (httpx, whatweb, wappalyzer)
- [ ] WAF detection (wafw00f)
- [ ] Virtual host discovery
- [ ] Directory brute force (ffuf, feroxbuster)
- [ ] API endpoint discovery
- [ ] JavaScript file analysis (LinkFinder, JSParser, manual grep)
- [ ] Parameter discovery (arjun, paramspider)
- [ ] robots.txt, sitemap.xml, .well-known/

---

## Phase 2: Application Mapping
- [ ] Crawl entire application manually (every page, every feature)
- [ ] Map all user roles and permission levels
- [ ] Identify all input points (forms, headers, cookies, URL params, file uploads)
- [ ] Identify all API endpoints
- [ ] Map authentication flow (login, register, forgot password, 2FA)
- [ ] Map authorization model (who can access what)
- [ ] Identify business logic flows (purchase, transfer, invite, etc.)
- [ ] Note all file upload points
- [ ] Note all redirect parameters
- [ ] Note all search/filter functionality
- [ ] Identify WebSocket connections
- [ ] Identify GraphQL endpoints
- [ ] Check mobile app (decompile APK/IPA)

---

## Phase 3: Authentication Testing
- [ ] Default credentials on login/admin panels
- [ ] Username enumeration (different responses for valid/invalid users)
- [ ] Brute force protection (rate limiting, account lockout)
- [ ] Password policy strength
- [ ] Password reset flow security
  - [ ] Token predictability
  - [ ] Token expiration
  - [ ] Token reuse
  - [ ] Host header injection
  - [ ] Email parameter injection
- [ ] Remember me token security
- [ ] Session management
  - [ ] Session token entropy
  - [ ] Session fixation
  - [ ] Session invalidation on logout
  - [ ] Session invalidation on password change
  - [ ] Concurrent session handling
  - [ ] Cookie flags (Secure, HttpOnly, SameSite)
- [ ] OAuth/OIDC flow testing
  - [ ] State parameter present and validated
  - [ ] Redirect URI validation strictness
  - [ ] Token leakage via referrer
  - [ ] Scope manipulation
- [ ] JWT testing
  - [ ] None algorithm
  - [ ] Algorithm confusion (RS256→HS256)
  - [ ] Key brute force
  - [ ] Claim tampering
  - [ ] Expiration validation
  - [ ] JWK/JKU injection
- [ ] 2FA bypass attempts
  - [ ] Skip 2FA step (direct navigation)
  - [ ] Response manipulation
  - [ ] OTP brute force
  - [ ] Backup code brute force
  - [ ] 2FA disable without re-auth

---

## Phase 4: Authorization Testing
- [ ] Horizontal privilege escalation (IDOR)
  - [ ] Every endpoint with user-specific data
  - [ ] Numeric IDs, UUIDs, emails, usernames as identifiers
  - [ ] POST/PUT/DELETE operations
  - [ ] File access by ID/name
  - [ ] API endpoints returning user data
- [ ] Vertical privilege escalation
  - [ ] Access admin endpoints as regular user
  - [ ] Modify role/permission in requests
  - [ ] API version bypass (/v1 vs /v3)
  - [ ] HTTP method tampering (GET→POST→PUT→DELETE)
  - [ ] Path traversal for endpoint access
- [ ] Mass assignment
  - [ ] Add role/admin/permission fields to POST/PUT
  - [ ] Add fields visible in API responses but not in forms
- [ ] Function-level access control
  - [ ] Every API endpoint tested with different auth levels
  - [ ] Every API endpoint tested without auth

---

## Phase 5: Injection Testing
- [ ] SQL injection (every parameter)
  - [ ] GET parameters
  - [ ] POST body parameters
  - [ ] Cookie values
  - [ ] HTTP headers (User-Agent, Referer, X-Forwarded-For)
  - [ ] JSON values
  - [ ] XML values
- [ ] NoSQL injection
- [ ] Command injection (every parameter that might reach OS)
- [ ] SSTI (template injection) — test in every text input
- [ ] XSS (every reflected/stored input)
  - [ ] Reflected in HTML body
  - [ ] Reflected in HTML attributes
  - [ ] Reflected in JavaScript context
  - [ ] Reflected in URL/href
  - [ ] Stored in profiles, comments, messages
  - [ ] DOM-based (check JS source/sink)
- [ ] XXE (every XML input, file upload)
- [ ] LDAP injection
- [ ] XPath injection
- [ ] Header injection (CRLF)
- [ ] Log injection

---

## Phase 6: Business Logic Testing
- [ ] Price/amount manipulation
  - [ ] Negative values
  - [ ] Zero values
  - [ ] Decimal manipulation
  - [ ] Currency confusion
  - [ ] Integer overflow
- [ ] Workflow bypass
  - [ ] Skip steps in multi-step process
  - [ ] Repeat steps
  - [ ] Out-of-order steps
- [ ] Race conditions
  - [ ] Simultaneous requests on state-changing operations
  - [ ] Coupon/voucher double-use
  - [ ] Balance manipulation
  - [ ] Vote/like inflation
- [ ] Feature abuse
  - [ ] Invite/referral system gaming
  - [ ] Free trial manipulation
  - [ ] Rate limit bypass
  - [ ] Data export abuse (mass download)
- [ ] Email/notification abuse
  - [ ] Email bombing via password reset
  - [ ] SMS bombing via phone verification

---

## Phase 7: File Upload Testing
- [ ] Extension validation bypass
  - [ ] Double extension (.php.jpg)
  - [ ] Null byte (.php%00.jpg)
  - [ ] Alternative extensions (.php5, .phtml, .phar)
  - [ ] Case sensitivity (.PhP)
  - [ ] Trailing characters (.php., .php::$DATA)
- [ ] Content-Type bypass
- [ ] Magic byte manipulation
- [ ] SVG with XSS
- [ ] Polyglot files
- [ ] ZIP-based attacks (symlink, zip slip)
- [ ] Image processing vulnerabilities (ImageMagick, Ghostscript)
- [ ] File size limits
- [ ] Path traversal in filename
- [ ] Overwrite existing files

---

## Phase 8: Server-Side Testing
- [ ] SSRF
  - [ ] Every URL parameter
  - [ ] Webhook URLs
  - [ ] File import from URL
  - [ ] Image/avatar from URL
  - [ ] PDF generator (HTML with external resources)
  - [ ] Cloud metadata access
  - [ ] Internal network scanning
- [ ] Deserialization
  - [ ] Java (rO0AB / ac ed 00 05 signatures)
  - [ ] PHP (O:4: format)
  - [ ] Python (pickle in cookies/tokens)
  - [ ] .NET (VIEWSTATE)
  - [ ] Node.js (node-serialize)
- [ ] Request smuggling (if reverse proxy detected)
- [ ] Cache poisoning (unkeyed headers/params)

---

## Phase 9: Client-Side Testing
- [ ] CORS misconfiguration
  - [ ] Reflected origin
  - [ ] Null origin
  - [ ] Subdomain wildcard
  - [ ] With credentials
- [ ] Clickjacking (X-Frame-Options, CSP frame-ancestors)
- [ ] Open redirect (every redirect parameter)
- [ ] Prototype pollution (JS merge/extend functions)
- [ ] WebSocket security
  - [ ] Missing auth
  - [ ] Cross-site WebSocket hijacking
  - [ ] Message injection
- [ ] PostMessage security (missing origin check)
- [ ] CSS injection
- [ ] DOM clobbering

---

## Phase 10: Infrastructure & Config
- [ ] Security headers review
  - [ ] Strict-Transport-Security (HSTS)
  - [ ] Content-Security-Policy (CSP)
  - [ ] X-Frame-Options
  - [ ] X-Content-Type-Options
  - [ ] Referrer-Policy
  - [ ] Permissions-Policy
- [ ] TLS/SSL configuration (testssl.sh, ssllabs.com)
- [ ] Cookie security flags
- [ ] HTTP methods allowed (OPTIONS request)
- [ ] Verbose error messages / stack traces
- [ ] Debug endpoints (/debug, /trace, /actuator, /elmah)
- [ ] Default pages (server info, phpinfo, etc.)
- [ ] Backup files (.bak, .old, .copy, ~, .swp)
- [ ] Source code exposure (.git, .svn, .env, .DS_Store)
- [ ] Admin panel discovery
- [ ] Database exposure (MongoDB, Redis, Elasticsearch without auth)
- [ ] Cloud storage misconfiguration (S3, GCS, Azure Blob)

---

## Phase 11: GraphQL (if applicable)
- [ ] Introspection enabled
- [ ] Field suggestion enumeration
- [ ] Authorization on every query/mutation
- [ ] Batching for rate limit bypass
- [ ] Alias-based batching
- [ ] Nested query DoS
- [ ] Injection in arguments
- [ ] Relationship traversal for data access

---

## Phase 12: API-Specific (if applicable)
- [ ] API documentation exposure (Swagger, OpenAPI)
- [ ] API versioning (old versions still accessible)
- [ ] Rate limiting on all endpoints
- [ ] Pagination limits
- [ ] Response filtering (API returns more than needed)
- [ ] Error handling (verbose errors with internal info)
- [ ] Content-Type enforcement
- [ ] HTTP method override headers (X-HTTP-Method-Override)
- [ ] API key exposure / mismanagement
- [ ] Webhook security (signature validation, SSRF)

---

## Phase 13: Mobile-Specific (if applicable)
- [ ] Decompile APK/IPA
- [ ] Hardcoded secrets in binary
- [ ] Certificate pinning (attempt bypass)
- [ ] Local data storage security
- [ ] Deep link / URL scheme abuse
- [ ] Intent/activity exposure (Android)
- [ ] Backup enabled (Android)
- [ ] Debug mode (Android)
- [ ] Clipboard data leakage
- [ ] Screenshot/screen recording protection

---

## Post-Discovery
- [ ] Attempt to chain findings for higher impact
- [ ] Document full exploitation path
- [ ] Create clean proof of concept
- [ ] Calculate CVSS accurately
- [ ] Check for duplicates in program's hacktivity
- [ ] Write clear, concise report
- [ ] Include remediation recommendations
- [ ] Review report before submission
