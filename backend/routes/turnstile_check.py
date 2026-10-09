"""
Cloudflare Turnstile verification — blocks scripted/bot traffic at the
earliest possible point, before the per-phone rate limit, circuit breaker,
or Lookup risk check even run. Added after the 2026-10-09 SMS-pumping
incident, where every fraudulent request showed zero human completion
(attempts_checked=0 across every row) — exactly the pattern an invisible
challenge is built to catch.

Token is produced client-side by a hidden WebView loading a small static
page (see static/turnstile-challenge.html) that runs Turnstile's Invisible
widget and posts the resulting token back to the app.

Soft-enforced for now: a MISSING token is logged but allowed through (older
app builds before this rollout won't have the WebView integration yet). A
PRESENT token that fails verification is refused — that's a real signal,
not a rollout gap. Tighten to hard-require once adoption of the new build
is high enough that a missing token is itself suspicious.
"""
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """True if the request should proceed. Fails OPEN on missing token
    (rollout gap) and on verification-service errors (never block real
    sign-ins over a Cloudflare outage) — fails CLOSED only when a token was
    actually presented and Cloudflare explicitly rejected it."""
    if not token:
        logger.info("[turnstile] no token presented (pre-rollout client) — allowing")
        return True

    secret = os.environ.get("TURNSTILE_SECRET_KEY")
    if not secret:
        logger.warning("[turnstile] TURNSTILE_SECRET_KEY not configured — allowing")
        return True

    try:
        payload = {"secret": secret, "response": token}
        if remote_ip:
            payload["remoteip"] = remote_ip
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(TURNSTILE_VERIFY_URL, data=payload)
        data = res.json()
    except Exception as e:
        logger.warning(f"[turnstile] verification call failed, allowing: {e}")
        return True

    if not data.get("success"):
        logger.warning(f"[turnstile] token rejected: {data.get('error-codes')}")
        return False

    return True
