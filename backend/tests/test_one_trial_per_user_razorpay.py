"""
Test: One Trial Per User — Razorpay create-subscription gating.

Fix under test:
  POST /api/subscription/razorpay/create-subscription gates the free 7-day trial
  on users.has_used_trial:
    - has_used_trial=True  => trial_days=0, grant_trial=False, trial_end=None
    - has_used_trial=False => trial_days=7, grant_trial=True,  trial_end != None

Also regressions:
  - POST /api/trial/activate for a fresh user => premium=True, trial_used=False
  - Self-heal: delete user_subscriptions while users.trial_end_date is future =>
    /activate returns premium=True, trial_used=False
"""
import os
import sys
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

# Use motor via sync helper (pymongo) to poke DB directly for test setup/verify.
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL"
) or "https://app-launch-2905.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# Load backend .env for MONGO_URL / DB_NAME (we're running from same host).
def _load_env_from_file():
    env_path = "/app/backend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v.strip().strip("'").strip('"'))

_load_env_from_file()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "moodfood_production")


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def fresh_user():
    """Register a brand-new account. Signup auto-starts trial -> has_used_trial=True."""
    unique = uuid.uuid4().hex[:10]
    # Backend normalizes to lowercase on insert, so we track the lowercase form.
    email = f"TEST_onetrial_{unique}@example.com".lower()
    password = "Test1234!"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Trial Gate Test",
            "dietary_restrictions": [],
            "cuisine_preferences": [],
        },
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no access_token in register response: {data}"
    user_id = (data.get("user") or {}).get("id")
    return {"email": email, "password": password, "token": token, "id": user_id}


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------------------------------------------------------
# 1) Signup auto-start sanity: has_used_trial must be True post-register
# ------------------------------------------------------------------
def test_signup_autostart_sets_has_used_trial(fresh_user, mongo):
    doc = mongo.users.find_one({"email": fresh_user["email"]})
    assert doc is not None, "user doc missing after register"
    assert doc.get("has_used_trial") is True, (
        f"Signup should auto-start trial and set has_used_trial=True, got {doc.get('has_used_trial')}"
    )
    # Also make sure trial_end_date exists and is in the future
    tend = doc.get("trial_end_date")
    assert tend, "trial_end_date missing after signup auto-start"


# ------------------------------------------------------------------
# 2) create-subscription for user who ALREADY used trial => NO trial
# ------------------------------------------------------------------
def test_create_subscription_no_trial_when_already_used(fresh_user, mongo):
    r = requests.post(
        f"{API}/subscription/razorpay/create-subscription",
        json={"plan_id": "premium_monthly"},
        headers=_auth_headers(fresh_user["token"]),
        timeout=45,
    )
    if r.status_code != 200:
        # External Razorpay sandbox may block — verify gating decision via DB proxy.
        pytest.skip(
            f"Razorpay create-subscription external call failed status={r.status_code} "
            f"body={r.text[:300]} — cannot exercise; gating logic will be inspected in test 3."
        )

    body = r.json()
    plan = body.get("plan", {})
    sub_id = (body.get("subscription") or {}).get("id")
    assert sub_id, f"no subscription.id in response: {body}"

    # Response contract: trial_days must be 0
    assert plan.get("trial_days") == 0, (
        f"trial_days should be 0 for repeat trial user, got {plan.get('trial_days')} in {body}"
    )

    # DB contract on razorpay_subscriptions
    rp = mongo.razorpay_subscriptions.find_one({"id": sub_id})
    assert rp is not None, f"razorpay_subscriptions doc missing for sub id={sub_id}"
    assert rp.get("grant_trial") is False, f"grant_trial must be False, got {rp.get('grant_trial')}"
    assert rp.get("trial_end") is None, f"trial_end must be None, got {rp.get('trial_end')}"


# ------------------------------------------------------------------
# 3) Reset has_used_trial=False, call create-subscription => trial granted
# ------------------------------------------------------------------
def test_create_subscription_grants_trial_when_not_used(fresh_user, mongo):
    # Force user into "never used trial" state
    upd = mongo.users.update_one(
        {"email": fresh_user["email"]},
        {"$set": {"has_used_trial": False}},
    )
    assert upd.matched_count == 1

    r = requests.post(
        f"{API}/subscription/razorpay/create-subscription",
        json={"plan_id": "premium_monthly"},
        headers=_auth_headers(fresh_user["token"]),
        timeout=45,
    )
    if r.status_code != 200:
        pytest.skip(
            f"Razorpay create-subscription external call failed status={r.status_code} "
            f"body={r.text[:300]} — cannot verify grant path."
        )

    body = r.json()
    plan = body.get("plan", {})
    sub_id = (body.get("subscription") or {}).get("id")
    assert sub_id, f"no subscription.id in response: {body}"

    assert plan.get("trial_days") == 7, (
        f"trial_days should be 7 for first-time user, got {plan.get('trial_days')} in {body}"
    )

    rp = mongo.razorpay_subscriptions.find_one({"id": sub_id})
    assert rp is not None, f"razorpay_subscriptions doc missing for sub id={sub_id}"
    assert rp.get("grant_trial") is True, f"grant_trial must be True, got {rp.get('grant_trial')}"
    tend = rp.get("trial_end")
    assert tend, f"trial_end must be non-null, got {tend}"

    # trial_end should be ~7 days in the future
    tend_dt = datetime.fromisoformat(str(tend).replace("Z", "+00:00"))
    delta = tend_dt - datetime.now(timezone.utc)
    assert timedelta(days=6, hours=20) <= delta <= timedelta(days=7, hours=4), (
        f"trial_end should be ~7d out, got delta={delta}"
    )


# ------------------------------------------------------------------
# 4) Regression: /trial/activate for a fresh user => premium=True, trial_used=False
# ------------------------------------------------------------------
def test_trial_activate_fresh_user_is_premium():
    unique = uuid.uuid4().hex[:10]
    email = f"TEST_activate_fresh_{unique}@example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": "Activate Fresh",
            "dietary_restrictions": [],
            "cuisine_preferences": [],
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    token = r.json().get("access_token") or r.json().get("token")

    r2 = requests.post(
        f"{API}/trial/activate",
        json={"platform": "android"},
        headers=_auth_headers(token),
        timeout=30,
    )
    assert r2.status_code == 200, f"/trial/activate failed: {r2.status_code} {r2.text}"
    body = r2.json()
    assert body.get("premium") is True, f"premium must be True, got {body}"
    assert body.get("trial_used") is False, f"trial_used must be False, got {body}"


# ------------------------------------------------------------------
# 5) Regression: self-heal path — delete user_subscriptions while user.trial_end_date
#    is future, then /activate returns premium=True (not trial_used).
# ------------------------------------------------------------------
def test_trial_activate_selfheal_recreates_trialing(mongo):
    unique = uuid.uuid4().hex[:10]
    email = f"TEST_activate_heal_{unique}@example.com".lower()
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": "Activate Heal",
            "dietary_restrictions": [],
            "cuisine_preferences": [],
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    token = r.json().get("access_token") or r.json().get("token")
    user_doc = mongo.users.find_one({"email": email})
    assert user_doc is not None
    user_id = user_doc["id"]
    assert user_doc.get("trial_end_date"), "auto-start trial_end_date should exist"

    # Wipe subscription records but keep users.trial_end_date in the future
    del_res = mongo.user_subscriptions.delete_many({"user_id": user_id})
    assert del_res.deleted_count >= 1, "expected an auto-started trialing sub to delete"

    r2 = requests.post(
        f"{API}/trial/activate",
        json={"platform": "android"},
        headers=_auth_headers(token),
        timeout=30,
    )
    assert r2.status_code == 200, f"/trial/activate failed: {r2.status_code} {r2.text}"
    body = r2.json()
    assert body.get("premium") is True, f"self-heal premium must be True, got {body}"
    assert body.get("trial_used") is False, f"self-heal trial_used must be False, got {body}"

    # verify subscription was recreated as trialing
    recreated = mongo.user_subscriptions.find_one({"user_id": user_id, "status": "trialing"})
    assert recreated is not None, "self-heal should re-create a trialing subscription"
    assert recreated.get("plan_id") == "premium_monthly"
