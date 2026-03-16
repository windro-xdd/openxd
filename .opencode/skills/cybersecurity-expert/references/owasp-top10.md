# OWASP Top 10 (2021) — Quick Reference

## A01: Broken Access Control (up from #5)
- IDOR, privilege escalation, CORS misconfiguration
- Missing function-level access control
- Metadata manipulation (JWT, cookies, hidden fields)
- Force browsing to authenticated/privileged pages

## A02: Cryptographic Failures (was "Sensitive Data Exposure")
- Data transmitted in cleartext (HTTP, FTP, SMTP)
- Weak/deprecated algorithms (MD5, SHA1, DES, RC4)
- Default or hardcoded crypto keys
- Missing certificate validation
- Passwords not hashed or using weak hashing (no salt, fast hash)

## A03: Injection
- SQL, NoSQL, OS command, LDAP, XPath, ORM, EL, OGNL
- SSTI (Server-Side Template Injection)
- Header injection
- Query parameterization is the primary defense

## A04: Insecure Design (NEW)
- Missing threat modeling
- Insufficient business logic validation
- Missing rate limiting on high-value transactions
- Lack of multi-layer defense
- Trust boundaries not defined

## A05: Security Misconfiguration (up from #6)
- Default credentials
- Unnecessary features enabled (ports, services, pages)
- Missing security headers
- Verbose error messages with stack traces
- Cloud service permissions too permissive
- Missing CORS policy or overly permissive

## A06: Vulnerable and Outdated Components
- Known CVEs in dependencies
- Unsupported/EOL software
- No automated scanning (Snyk, Dependabot, npm audit)
- Component versions not tracked

## A07: Identification and Authentication Failures (was #2)
- Credential stuffing / brute force allowed
- Weak passwords permitted
- Missing/ineffective MFA
- Session fixation
- Session IDs in URL
- Improper session invalidation

## A08: Software and Data Integrity Failures (NEW)
- Insecure CI/CD pipeline
- Auto-update without integrity verification
- Insecure deserialization
- Dependencies from untrusted sources
- Missing code signing

## A09: Security Logging and Monitoring Failures (was #10)
- Login/access control failures not logged
- Logs not monitored
- Logs only stored locally
- No alerting thresholds
- Penetration testing doesn't trigger alerts

## A10: Server-Side Request Forgery (NEW)
- URL fetching without validation
- Access to cloud metadata services
- Internal port scanning
- Access to internal services
- URL schema enforcement missing (allow list)

---

# OWASP API Security Top 10 (2023)

## API1: Broken Object Level Authorization
## API2: Broken Authentication  
## API3: Broken Object Property Level Authorization
## API4: Unrestricted Resource Consumption
## API5: Broken Function Level Authorization
## API6: Unrestricted Access to Sensitive Business Flows
## API7: Server Side Request Forgery
## API8: Security Misconfiguration
## API9: Improper Inventory Management
## API10: Unsafe Consumption of APIs

---

# OWASP Mobile Top 10 (2024)

## M1: Improper Credential Usage
## M2: Inadequate Supply Chain Security
## M3: Insecure Authentication/Authorization
## M4: Insufficient Input/Output Validation
## M5: Insecure Communication
## M6: Inadequate Privacy Controls
## M7: Insufficient Binary Protections
## M8: Security Misconfiguration
## M9: Insecure Data Storage
## M10: Insufficient Cryptography
