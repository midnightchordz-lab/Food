"""
Additive, non-breaking security middleware (Deep Security Audit — 47 vectors).

Design rule: valid requests behave EXACTLY as before. These layers only reject
clearly-abusive traffic, so no client code changes and no user-visible change.

Covers (edge-level): 1.4 TRACE/TRACK/CONNECT, 1.5 method-override header,
1.7/3.5 oversized body, 2.6 secret-in-query, 3.1/5.3/6.1 global per-IP flood
limiting, 7.2 request smuggling. Other vectors are handled in app code
(JWT algo/exp pinning, per-user image cap, admin RBAC, OTP rate limits).
"""
import time
import logging
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("security")

MAX_BODY_BYTES = 25 * 1024 * 1024        # 25MB — well above any legit payload (base64 photos ~7MB)
BLOCKED_METHODS = {"TRACE", "TRACK", "CONNECT"}
SECRET_QUERY_KEYS = {"api_key", "apikey", "api-key", "access_token"}

# Lightweight in-memory sliding-window flood guard (per client IP). Deliberately
# generous so normal usage / automated tests are never affected — it only trips
# on egregious abuse (scraping, credential stuffing, distributed spam via one IP).
FLOOD_WINDOW_SECONDS = 60
FLOOD_MAX_REQUESTS = 600                 # 10 req/sec sustained per IP
_ip_hits: dict[str, deque] = defaultdict(deque)

# Stricter per-IP limits for sensitive auth endpoints (brute-force / spam defense).
# Keyed by (ip, bucket). Still generous enough for real users on shared NATs.
AUTH_LIMITS = {
    "login":   (60, 300),    # /auth/login + /auth/session + /auth/apple  → 60 / 5 min
    "refresh": (120, 300),   # /auth/refresh (silent refresh can be chatty) → 120 / 5 min
    "otp":     (15, 300),    # /auth/phone/send-otp                        → 15 / 5 min
    "register":(40, 3600),   # /auth/register                             → 40 / hour
}
_auth_hits: dict[str, deque] = defaultdict(deque)


def _auth_bucket(method: str, path: str):
    if method != "POST":
        return None
    if path.endswith("/auth/register"):
        return "register"
    if path.endswith("/auth/phone/send-otp"):
        return "otp"
    if path.endswith("/auth/refresh"):
        return "refresh"
    if path.endswith("/auth/login") or path.endswith("/auth/session") or path.endswith("/auth/apple") or path.endswith("/auth/phone/verify-otp"):
        return "login"
    return None


def _client_ip(request: Request) -> str:
    # Honor the proxy chain (ingress sets X-Forwarded-For); fall back to peer.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def security_middleware(request: Request, call_next):
    method = request.method.upper()

    # 1.4 — dangerous methods can leak headers/tokens or aid recon.
    if method in BLOCKED_METHODS:
        return JSONResponse(status_code=405, content={"detail": "Method not allowed"})

    # 1.5 — never honor a method-override header (would bypass method-scoped rules).
    if "x-http-method-override" in request.headers:
        return JSONResponse(status_code=400, content={"detail": "Method override not allowed"})

    # 7.2 — classic request-smuggling signature: both framing headers present.
    if "content-length" in request.headers and "transfer-encoding" in request.headers:
        logger.warning("Rejected possible request smuggling (CL + TE)")
        return JSONResponse(status_code=400, content={"detail": "Invalid request framing"})

    # 1.7 / 3.5 — cap declared body size (defends oversized/compression-bomb uploads).
    cl = request.headers.get("content-length")
    if cl:
        try:
            if int(cl) > MAX_BODY_BYTES:
                return JSONResponse(status_code=413, content={"detail": "Payload too large"})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})

    # 2.6 — secrets belong in the Authorization header, never the query string.
    for k in request.query_params.keys():
        if k.lower() in SECRET_QUERY_KEYS:
            logger.warning(f"Rejected secret in query string: {k}")
            return JSONResponse(
                status_code=400,
                content={"detail": "Credentials must be sent in the Authorization header"},
            )

    # 3.1 / 5.3 / 6.1 — per-IP flood guard (in-memory sliding window). Generous
    # limit so real users and CI never hit it; only abusive bursts are throttled.
    ip = _client_ip(request)
    now = time.monotonic()
    hits = _ip_hits[ip]
    cutoff = now - FLOOD_WINDOW_SECONDS
    while hits and hits[0] < cutoff:
        hits.popleft()
    if len(hits) >= FLOOD_MAX_REQUESTS:
        retry = max(1, int(FLOOD_WINDOW_SECONDS - (now - hits[0])))
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests"},
            headers={"Retry-After": str(retry)},
        )
    hits.append(now)
    # Prevent unbounded growth from one-off IPs.
    if len(_ip_hits) > 10000:
        for stale_ip in [k for k, v in list(_ip_hits.items())[:2000] if not v or v[-1] < cutoff]:
            _ip_hits.pop(stale_ip, None)

    # Stricter throttle for sensitive auth endpoints (brute force / OTP spam).
    bucket = _auth_bucket(method, request.url.path)
    if bucket:
        limit, window = AUTH_LIMITS[bucket]
        akey = f"{ip}:{bucket}"
        ahits = _auth_hits[akey]
        acut = now - window
        while ahits and ahits[0] < acut:
            ahits.popleft()
        if len(ahits) >= limit:
            retry = max(1, int(window - (now - ahits[0])))
            logger.warning(f"Auth throttle hit: {akey}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many attempts — please wait and try again"},
                headers={"Retry-After": str(retry)},
            )
        ahits.append(now)

    return await call_next(request)
