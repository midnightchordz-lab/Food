"""
Shared Twilio client factory.

Prefers a scoped Restricted API Key (TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET)
over the account's Auth Token when both are configured. The Auth Token is the
account-wide master credential — anyone who has it can do anything on the
account, including things unrelated to sending a verification SMS. A
Restricted API Key, scoped in Twilio Console to just the Verify/Lookup/
Messaging permissions this app actually uses, limits the blast radius if it
ever leaks, and can be individually revoked without rotating (and breaking)
every other integration that uses the Auth Token.

Falls back to Account SID + Auth Token when no API Key is configured yet, so
this is a drop-in upgrade — nothing breaks before the key exists.
"""
import os
from typing import Optional


def get_twilio_client() -> Optional["Client"]:  # noqa: F821 (Client imported lazily below)
    from twilio.rest import Client

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    if not account_sid:
        return None

    api_key_sid = os.environ.get("TWILIO_API_KEY_SID")
    api_key_secret = os.environ.get("TWILIO_API_KEY_SECRET")
    if api_key_sid and api_key_secret:
        return Client(api_key_sid, api_key_secret, account_sid)

    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if auth_token:
        return Client(account_sid, auth_token)

    return None
