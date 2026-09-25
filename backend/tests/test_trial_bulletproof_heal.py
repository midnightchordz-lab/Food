"""
Test suite for the trial 'bulletproof heal' logic in POST /api/trial/activate.

Scenarios (see review request):
  1) BULLETPROOF HEAL - has_used_trial=True flag but ZERO user_subscriptions docs -> force-grant trial.
  2) GENUINELY USED TRIAL - has_used_trial=True AND an expired trial sub doc -> blocked.
  3) FRESH USER happy path - just registered, activate -> premium=true.
  4) SELF-HEAL in window - user doc trial_end_date in future, subs deleted -> re-activated.

Uses direct Mongo access (backend/.env: MONGO_URL, DB_NAME) to force the broken
states without hitting Razorpay.
"""
import os
import uuid
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

# Load backend .env for MONGO_URL / DB_NAME
load_dotenv(Path("/app/backend/.env"))

# ---- resolve BASE_URL from frontend/.env (EXPO_PUBLIC_BACKEND_URL) ----
_FE_ENV = Path("/app/frontend/.env")
BASE_URL = None
if _FE_ENV.exists():
    for line in _FE_ENV.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
if not BASE_URL:
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]


# ---------- helpers ----------
def _register() -> dict:
    """Register a fresh account. Returns dict with token and user_id."""
    email = f"TEST_trial_{uuid.uuid4().hex[:10]}@example.com"
    payload = {"email": email, "password": "Test1234!", "name": "Trial QA"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token")
    user = data.get("user") or {}
    user_id = user.get("id")
    assert token and user_id, f"missing token/user_id: {data}"
    return {"email": email, "token": token, "user_id": user_id}


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _activate(token: str, platform: str = "android") -> requests.Response:
    return requests.post(
        f"{API}/trial/activate",
        json={"platform": platform},
        headers=_auth_headers(token),
        timeout=20,
    )


def _current(token: str) -> requests.Response:
    return requests.get(f"{API}/subscription/current", headers=_auth_headers(token), timeout=20)


@pytest.fixture
def created_users():
    """Track user ids for cleanup at end of each test."""
    ids: list[str] = []
    yield ids
    for uid in ids:
        _db.users.delete_many({"id": uid})
        _db.user_subscriptions.delete_many({"user_id": uid})
        _db.payment_transactions.delete_many({"user_id": uid})
        _db.razorpay_orders.delete_many({"user_id": uid})
        _db.razorpay_subscriptions.delete_many({"user_id": uid})


# =====================================================================
# Test 1: BULLETPROOF HEAL - flag set, but ZERO subscription docs -> heal
# =====================================================================
def test_bulletproof_heal_grants_trial_when_no_subscription_docs(created_users):
    u = _register()
    created_users.append(u["user_id"])

    # Force broken state: flag says trial used, but no sub exists (mimics
    # signup where the flag was set but the trial sub was never persisted).
    _db.users.update_one(
        {"id": u["user_id"]},
        {
            "$set": {"has_used_trial": True},
            "$unset": {"trial_start_date": "", "trial_end_date": "", "trial_active": ""},
        },
    )
    _db.user_subscriptions.delete_many({"user_id": u["user_id"]})

    # sanity
    assert _db.user_subscriptions.count_documents({"user_id": u["user_id"]}) == 0

    r = _activate(u["token"], "android")
    assert r.status_code == 200, f"activate returned {r.status_code}: {r.text}"
    body = r.json()

    assert body.get("success") is True
    assert body.get("premium") is True, f"expected premium=true, got {body}"
    assert body.get("trial_used") is False, f"expected trial_used=false, got {body}"
    assert body.get("reason") == "Trial granted", f"expected reason 'Trial granted', got {body.get('reason')}"

    # Verify a real trialing subscription doc now exists
    sub = _db.user_subscriptions.find_one({"user_id": u["user_id"]})
    assert sub is not None, "sub doc must exist after heal"
    assert sub.get("status") == "trialing"
    assert sub.get("plan_id") == "premium_monthly"
    assert sub.get("source") == "trial"

    # And /subscription/current must reflect premium/trialing
    cur = _current(u["token"])
    assert cur.status_code == 200, cur.text
    cur_body = cur.json()
    sub_out = cur_body.get("subscription", {}) or {}
    # Various possible shapes -> assert one of the strong markers is present
    plan_id = sub_out.get("plan_id") or (sub_out.get("plan") or {}).get("plan_id")
    status = sub_out.get("status")
    assert plan_id == "premium_monthly", f"current sub plan_id: {plan_id}, body: {cur_body}"
    assert status in ("trialing", "active"), f"current sub status: {status}, body: {cur_body}"


# =====================================================================
# Test 2: GENUINELY USED TRIAL - expired sub doc present -> blocked
# =====================================================================
def test_genuinely_used_trial_is_still_blocked(created_users):
    u = _register()
    created_users.append(u["user_id"])

    past_start = datetime.now(timezone.utc) - timedelta(days=14)
    past_end = datetime.now(timezone.utc) - timedelta(days=7)

    _db.users.update_one(
        {"id": u["user_id"]},
        {
            "$set": {
                "has_used_trial": True,
                "trial_start_date": past_start.isoformat(),
                "trial_end_date": past_end.isoformat(),
                "trial_active": False,
            }
        },
    )
    _db.user_subscriptions.delete_many({"user_id": u["user_id"]})
    _db.user_subscriptions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": u["user_id"],
        "plan_id": "premium_monthly",
        "status": "expired",
        "source": "trial",
        "trial_start": past_start.isoformat(),
        "trial_end": past_end.isoformat(),
        "created_at": past_start.isoformat(),
        "updated_at": past_end.isoformat(),
        "is_trial": True,
    })

    r = _activate(u["token"], "android")
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    body = r.json()
    assert body.get("premium") is False, f"expected premium=false for used trial, got {body}"
    assert body.get("trial_used") is True, f"expected trial_used=true, got {body}"

    # The expired doc must still be there — no new trialing doc should be created
    trialing = _db.user_subscriptions.count_documents(
        {"user_id": u["user_id"], "status": "trialing"}
    )
    assert trialing == 0, "no new trialing sub should have been created for a genuinely-used trial"


# =====================================================================
# Test 3: FRESH USER happy path
# =====================================================================
def test_fresh_user_activate_returns_premium(created_users):
    u = _register()
    created_users.append(u["user_id"])

    # Registration auto-starts a trial via auto_start_trial_if_eligible.
    # Calling activate again must be idempotent and still report premium.
    r = _activate(u["token"], "android")
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    body = r.json()
    assert body.get("premium") is True, f"fresh user must be premium, got {body}"
    assert body.get("trial_used") is False, f"fresh user trial_used should be false, got {body}"

    sub = _db.user_subscriptions.find_one(
        {"user_id": u["user_id"], "status": {"$in": ["trialing", "active"]}}
    )
    assert sub is not None, "fresh user must have a trialing/active sub after activate"
    assert sub.get("plan_id") == "premium_monthly"


# =====================================================================
# Test 4: SELF-HEAL in window — user doc trial_end in future, subs missing
# =====================================================================
def test_selfheal_in_window_reactivates_trial(created_users):
    u = _register()
    created_users.append(u["user_id"])

    # keep users.trial_end_date in the FUTURE, delete the sub doc(s)
    future_end = datetime.now(timezone.utc) + timedelta(days=5)
    _db.users.update_one(
        {"id": u["user_id"]},
        {
            "$set": {
                "has_used_trial": True,
                "trial_start_date": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
                "trial_end_date": future_end.isoformat(),
                "trial_active": True,
            }
        },
    )
    _db.user_subscriptions.delete_many({"user_id": u["user_id"]})
    assert _db.user_subscriptions.count_documents({"user_id": u["user_id"]}) == 0

    r = _activate(u["token"], "android")
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    body = r.json()
    assert body.get("premium") is True, f"in-window user must be premium, got {body}"
    assert body.get("trial_used") is False, f"in-window user trial_used should be false, got {body}"
    assert body.get("reason") == "Trial re-activated", f"expected 'Trial re-activated', got {body.get('reason')}"

    sub = _db.user_subscriptions.find_one({"user_id": u["user_id"]})
    assert sub is not None
    assert sub.get("status") == "trialing"
    assert sub.get("plan_id") == "premium_monthly"
    assert sub.get("source") == "trial"
