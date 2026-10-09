"""
Twilio Lookup v2 SMS-pumping risk pre-check.

Called right before an OTP is actually sent (after the per-phone limit and
the global circuit breaker, both of which only react to volume already in
flight). This checks the destination number itself: Twilio's own model
scores it 0-100 using carrier reputation, abnormal traffic patterns, and
historically low OTP-completion rates — exactly the "sent 5 times, never
verified" pattern that drained the account on 2026-10-09. A Lookup call
costs ~$0.025 outside North America (free in NA) versus $0.34-0.44 for the
Verify SMS it prevents, so blocking here is roughly 10-15x cheaper than
letting a bad send through.

Twilio explicitly doesn't recommend this package for US/Canada numbers
(not a meaningfully targeted region), but it's safe to call for those too —
it just won't do much there. Fails OPEN on any error (missing credentials,
Twilio API error, timeout): a broken risk check must never block real
signups, since the per-phone limit, circuit breaker, and Fraud Guard are
all still in place as the real backstops.
"""
import logging
import os

logger = logging.getLogger(__name__)

# Twilio's own bands: 0-60 low, 60-75 mild, 75-90 moderate, 90-100 high.
# Default sits at the "moderate" boundary — blocks the traffic pattern we
# actually saw without being so aggressive it risks real users on unusual
# but legitimate carriers. Override via env if real-world data suggests
# a different cutoff.
DEFAULT_RISK_THRESHOLD = int(os.environ.get("SMS_PUMPING_RISK_THRESHOLD", "75"))


async def is_high_risk_number(phone: str, threshold: int = DEFAULT_RISK_THRESHOLD) -> bool:
    """True if this destination should be silently refused. Never raises —
    any failure to determine risk is treated as low-risk (fail open)."""
    try:
        import asyncio
        from .twilio_client import get_twilio_client

        client = get_twilio_client()
        if client is None:
            return False

        def _lookup():
            return client.lookups.v2.phone_numbers(phone).fetch(fields="sms_pumping_risk")

        result = await asyncio.to_thread(_lookup)
        risk = getattr(result, "sms_pumping_risk", None) or {}

        if risk.get("number_blocked"):
            logger.warning(f"[sms_pumping_check] {phone[-4:]}: previously blocked by Twilio — refusing")
            return True

        score = risk.get("sms_pumping_risk_score")
        if score is not None and score >= threshold:
            logger.warning(f"[sms_pumping_check] {phone[-4:]}: risk score {score} >= {threshold} — refusing")
            return True

        return False
    except Exception as e:
        # Fail open — a Lookup outage must never take down real sign-ins.
        logger.warning(f"[sms_pumping_check] lookup failed for {phone[-4:]}, allowing through: {e}")
        return False
