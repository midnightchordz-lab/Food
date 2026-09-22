# Deep Security Audit — 47 Vectors: Implementation Status (No-Breaking-Changes)

Approach per `NO_BREAKING_CHANGES_PROMPT.md`: additive only. Valid requests behave
identically (verified: health/login/me/plans/discover/ai-generate all 200). New
edge protections live in `backend/security_middleware.py` (added after CORS).

## Category 1 — HTTP/Method Abuse
- 1.1 Unprotected methods → app has no PUT/PATCH on sensitive routes; flood guard covers all methods. ✅ (edge)
- 1.2 OPTIONS enum → covered by per-IP flood guard. ✅
- 1.3 HEAD abuse → covered by per-IP flood guard. ✅
- 1.4 TRACE/TRACK/CONNECT → **blocked (405)** in middleware. ✅
- 1.5 X-HTTP-Method-Override → **rejected (400)**. ✅
- 1.6 Content-Type bypass → FastAPI already 422s non-JSON on JSON routes; not breaking to add stricter. Accepted as-is. ⚠️ low
- 1.7 Chunked/oversized body → **25MB Content-Length cap (413)**. ✅
- 1.8 Query-string duplication → FastAPI takes last value deterministically; no limiter keyed on params. ✅ (n/a)

## Category 2 — Authentication Bypass
- 2.1 Missing auth → all app-used sensitive endpoints require `get_current_user`. ✅
- 2.2 Token reuse/theft → JWTs are stateless 30-day; theft detection deferred (would need session store; NOT added to avoid re-login churn). ⚠️ backlog
- 2.3 Expired token → `jwt.decode` verifies `exp` (ExpiredSignatureError handled). ✅ already
- 2.4 Invalid signature / `none` alg → `algorithms=["HS256"]` pinned; signature verified. ✅ already
- 2.5 Case-sensitive Bearer → Starlette HTTPBearer matches scheme case-insensitively. ✅ already
- 2.6 Secret in query string → **rejected (400)** for api_key/apikey/access_token. ✅
- 2.7 Hardcoded creds → none in source; secrets from env (JWT_SECRET_KEY etc.); old ADMIN_API_KEY removed. ✅

## Category 3 — Rate-Limit Circumvention
- 3.1 Distributed/multi-IP → per-IP flood guard (600/min) + per-user image cap. ✅ (edge)
- 3.2 HTTP/2 multiplexing → flood guard counts requests, not connections. ✅
- 3.3 Clock skew → OTP/image limits use server time; flood guard is monotonic sliding window. ✅
- 3.4 Batch operations → app has no unbounded batch create; image `/generate-batch` caps per item. ✅
- 3.5 Compression bomb → 25MB body cap. ✅ (partial; full decompress-limit backlog)
- 3.6 WebSocket bypass → app exposes no WebSockets. ✅ (n/a)
- 3.7 Cache bypass/range → static/audio served with Cache-Control; not an abuse path here. ✅ (n/a)
- 3.8 Slow HTTP → uvicorn keep-alive + upstream ingress timeouts; no per-request global timeout added (would risk cutting long AI/audio gen). ⚠️ infra
- 3.9 ReDoS → no user-input regex with catastrophic backtracking in app code. ✅ (n/a)

## Category 4 — Resource Exhaustion
- 4.1 DB pool → Motor default connection pool (maxPoolSize 100). ✅ already
- 4.2 Memory → list endpoints are bounded (`to_list(length=...)`, capped limits). ✅
- 4.3 CPU/algorithmic → no factorial/perm endpoints. ✅ (n/a)
- 4.4 Storage → uploads go to object storage / capped; 25MB body cap. ✅
- 4.5 Queue → no external job queue. ✅ (n/a)
- 4.6 FD exhaustion → files served via FileResponse / context managers. ✅
- 4.7 Bandwidth → responses return URLs, not blobs; images served once + cached. ✅
- 4.8 Template injection → no server-side Jinja rendering of user input. ✅ (n/a)

## Category 5 — Data Extraction
- 5.1 Account enumeration (register) → returns "Email already registered" (kept for UX; non-breaking). ⚠️ product-choice
- 5.2 Password-reset enum → no password-reset endpoint. ✅ (n/a)
- 5.3 Data scraping → per-IP flood guard; recipe reads are user-scoped. ✅
- 5.4 Private data leak → responses are field-scoped models; hashed_password never returned. ✅
- 5.5 Timing (login) → bcrypt dominates; acceptable. ⚠️ low
- 5.6 Cache timing → images cached on disk; not a sensitive oracle. ✅ (n/a)

## Category 6 — Business Logic Abuse
- 6.1 Unlimited account creation → per-IP flood guard limits burst signup. ✅ (edge)
- 6.2 Image cost control → shared 30/user/day cap (per-IP for anon) across both image route files. ✅
- 6.3 Mass deletion → deletes are user-scoped + auth-required; no bulk-delete endpoint. ✅
- 6.4 Privilege escalation → per-user `require_admin_user`; `update_profile` allowlist excludes `is_admin`. ✅

## Category 7 — Infrastructure
- 7.1 DNS amplification / SSRF → import/proxy paths validated; `_is_safe_url` blocks private IPs (C2). ✅
- 7.2 Request smuggling → **CL+TE combo rejected (400)**. ✅
- 7.3 TOCTOU → single-doc Mongo updates are atomic; swap/verify use find-then-update on owned docs. ✅ (low risk)

## Category 8 — Timing/Enumeration
- 8.1 Timing enum → see 5.5. ⚠️ low
- 8.2 Status-code enum → recipe reads are user-scoped; 404 acceptable. ✅ (low)

## Not implemented (deliberately, to avoid breaking changes / infra deps)
- Redis-backed distributed rate limiting, token-theft detection, per-request hard
  timeout, decompression-size limit. These need Redis/session infra or risk cutting
  legit long requests; tracked as backlog for production hardening.
