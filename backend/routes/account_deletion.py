"""
Public, no-login account & data deletion page (Google Play Data Safety
requirement). Reachable at /api/account-deletion without the app. Ownership is
proven with email + password (same credentials as login), so no one can delete
someone else's account. Social/phone-login users are directed to the in-app
flow or support. Deletes the exact same data as the in-app DELETE /auth/account.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
import logging

from .db import db
from .security import verify_password
from .rate_limit import check_rate_limit

router = APIRouter(prefix="/account-deletion", tags=["Account Deletion"])

# Every collection that stores per-user data (kept in sync with DELETE /auth/account).
USER_DATA_COLLECTIONS = [
    "saved_recipes", "user_subscriptions", "razorpay_subscriptions", "razorpay_orders",
    "payment_transactions", "meal_preferences", "user_exclusions", "shopping_lists",
    "weekly_plans", "imported_recipes", "chat_messages", "push_users", "feature_usage",
    "daily_usage", "image_gen_usage", "usage_tracking", "user_usage", "recipe_ratings",
    "fridge_scans", "diabetes_chat_messages", "diabetes_meal_preferences",
    "diabetes_weekly_plans", "mobile_diabetes_plans", "meal_reminders", "used_recipes",
    "recipe_subscriptions", "audit_logs", "auth_events", "otp_verifications",
]


async def purge_user_data(uid: str) -> None:
    """Permanently delete a user and all their personal data. Idempotent."""
    now = datetime.now(timezone.utc)
    for coll in USER_DATA_COLLECTIONS:
        try:
            await db[coll].delete_many({"user_id": uid})
        except Exception:
            pass
    try:
        await db.refresh_tokens.update_many(
            {"user_id": uid, "revoked_at": None},
            {"$set": {"revoked_at": now, "revocation_reason": "account_deleted"}},
        )
        await db.refresh_tokens.delete_many({"user_id": uid})
    except Exception:
        pass
    await db.users.delete_one({"id": uid})
    logging.info(f"[ACCOUNT] Purged account and personal data for user {uid}")


class DeletionRequest(BaseModel):
    email: EmailStr
    password: str


def _page(inner: str) -> HTMLResponse:
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete your MoodFood account</title>
<style>
  :root {{ --brand:#C87D56; --fg:#2A2724; --muted:#7A736C; --bg:#F9F8F6; --card:#fff; --border:#EAE5DF; --danger:#C0392B; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--fg); }}
  .wrap {{ max-width:560px; margin:0 auto; padding:32px 20px 64px; }}
  h1 {{ font-size:26px; margin:0 0 6px; }}
  h2 {{ font-size:16px; margin:24px 0 8px; }}
  p, li {{ color:var(--muted); line-height:1.55; font-size:14.5px; }}
  .card {{ background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px; margin-top:20px; }}
  label {{ display:block; font-size:13px; color:var(--fg); font-weight:600; margin:14px 0 6px; }}
  input {{ width:100%; padding:12px 14px; border:1px solid var(--border); border-radius:10px; font-size:15px; }}
  button {{ width:100%; margin-top:20px; padding:14px; border:0; border-radius:999px; background:var(--danger); color:#fff; font-size:15px; font-weight:600; cursor:pointer; }}
  button:disabled {{ opacity:.6; cursor:default; }}
  .brand {{ color:var(--brand); font-weight:700; }}
  .note {{ font-size:12.5px; }}
  #msg {{ margin-top:16px; font-size:14px; border-radius:10px; padding:12px 14px; display:none; }}
  .ok {{ background:#EAF7EE; color:#1E7B3C; }}
  .err {{ background:#FDEDEC; color:var(--danger); }}
</style></head>
<body><div class="wrap">{inner}</div>
<script>
  const form = document.getElementById('f');
  if (form) form.addEventListener('submit', async (e) => {{
    e.preventDefault();
    const btn = form.querySelector('button'); const msg = document.getElementById('msg');
    btn.disabled = true; btn.textContent = 'Deleting…'; msg.style.display='none';
    try {{
      const r = await fetch('/api/account-deletion/request', {{
        method:'POST', headers:{{'Content-Type':'application/json'}},
        body: JSON.stringify({{ email: form.email.value.trim(), password: form.password.value }})
      }});
      const d = await r.json();
      msg.style.display='block';
      if (r.ok) {{ msg.className='ok'; msg.textContent = d.message || 'Your account has been permanently deleted.'; form.style.display='none'; }}
      else {{ msg.className='err'; msg.textContent = d.detail || 'Could not delete the account. Check your email and password.'; btn.disabled=false; btn.textContent='Delete my account'; }}
    }} catch (_e) {{
      msg.style.display='block'; msg.className='err'; msg.textContent='Something went wrong. Please try again.';
      btn.disabled=false; btn.textContent='Delete my account';
    }}
  }});
</script></body></html>"""
    return HTMLResponse(content=html)


@router.get("")
async def deletion_page():
    inner = """
    <h1>Delete your <span class="brand">MoodFood</span> account</h1>
    <p>Use this page to permanently delete your MoodFood account and all associated data. This cannot be undone.</p>

    <h2>What gets deleted</h2>
    <ul>
      <li>Your profile and login credentials</li>
      <li>Saved recipes, meal plans and shopping lists</li>
      <li>Subscription and payment records</li>
      <li>AI chat history, fridge scans and usage data</li>
      <li>Push notification tokens and preferences</li>
    </ul>
    <p class="note">Deletion is immediate and permanent. We retain nothing tied to your account, except minimal records we are legally required to keep (e.g. tax/payment invoices), which are anonymised.</p>

    <div class="card">
      <p style="margin-top:0;color:var(--fg);font-weight:600;">Confirm it's you</p>
      <p class="note">Enter the email and password for the account you want to delete.</p>
      <form id="f">
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" autocomplete="email" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Delete my account</button>
      </form>
      <div id="msg"></div>
      <p class="note" style="margin-top:18px;">Signed up with Google, Apple or phone number (no password)? Delete your account in the app under <b>Profile → Delete account</b>, or email <a href="mailto:support@moodfood.in">support@moodfood.in</a> and we'll remove it for you.</p>
    </div>
    """
    return _page(inner)


@router.post("/request")
async def request_deletion(body: DeletionRequest, request: Request):
    # Throttle by IP so the page can't be used to brute-force passwords.
    fwd = request.headers.get("x-forwarded-for")
    ip = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown"))
    await check_rate_limit(f"acctdel:{ip}", max_requests=10, window_seconds=3600)

    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("hashed_password"):
        # No password on record (social/phone login) or no such account.
        raise HTTPException(status_code=400, detail="Email or password is incorrect. Social/phone-login accounts must be deleted in the app or via support.")
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Email or password is incorrect.")

    await purge_user_data(user["id"])
    return {"success": True, "message": "Your MoodFood account and all associated data have been permanently deleted."}
