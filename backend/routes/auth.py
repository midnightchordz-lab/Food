"""
Authentication routes - register, login, phone OTP, profile
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import random
import sys

from .deps import (
    db, User, UserRegister, UserLogin, Token, 
    PhoneSendOTP, PhoneVerifyOTP, PhoneLoginResponse,
    get_current_user, verify_password, get_password_hash, create_access_token,
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS
)

# Add backend to path for services import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.entitlement_guard import (
    log_security_event,
    SecurityEvent
)
from .trial import auto_start_trial_if_eligible
import jwt

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory OTP storage (use Redis in production)
otp_storage = {}

# Twilio phone number for sending SMS
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '+19064011655')


@router.post("/register", response_model=Token)
async def register(user: UserRegister):
    """
    USER CREATION - HARD DEFAULTS (MANDATORY)
    
    On every new user registration, hard-set:
        plan = "free"
        subscription_status = "inactive"
        trial_active = false
        entitlement_tier = "free"
    
    Values must NEVER be null or undefined.
    Premium requires payment or explicit trial activation.
    
    AUTO-START TRIAL:
    After registration, automatically start 7-day trial for new users.
    """
    # Check if user exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user.password)
    now = datetime.now(timezone.utc)
    
    # HARD DEFAULTS - NEVER NULL/UNDEFINED
    user_data = {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "hashed_password": hashed_password,
        "dietary_restrictions": user.dietary_restrictions,
        "cuisine_preferences": user.cuisine_preferences,
        "created_at": now.isoformat(),
        # === MANDATORY ENTITLEMENT DEFAULTS ===
        "default_plan": "free",           # ALWAYS "free"
        "subscription_status": "inactive", # ALWAYS "inactive" 
        "trial_active": False,            # ALWAYS False (will be updated by auto-start)
        "entitlement_tier": "free",       # ALWAYS "free" (will be updated by auto-start)
        # === END MANDATORY DEFAULTS ===
    }
    
    await db.users.insert_one(user_data)
    
    # LOG NEW USER CREATION
    log_security_event(
        event_type=SecurityEvent.SUBSCRIPTION_CREATED,
        user_id=user_id,
        source="signup",
        plan_id="free",
        details={
            "email": user.email,
            "action": "user_registered",
            "default_plan": "free",
            "subscription_status": "inactive",
            "trial_active": False,
            "entitlement_tier": "free"
        }
    )
    
    # ============ AUTO-START TRIAL ============
    trial_result = None
    try:
        # Get platform from request if available (default to 'web')
        platform = getattr(user, 'platform', 'web') or 'web'
        trial_result = await auto_start_trial_if_eligible(user_id, platform)
        if trial_result.get("started"):
            logging.info(f"✅ Trial auto-started for new user: {user.email}")
    except Exception as trial_error:
        logging.error(f"⚠️ Trial auto-start failed for {user.email}: {trial_error}")
        # Don't fail registration if trial fails
    # ==========================================
    
    # Create token
    access_token = create_access_token({"sub": user_id})
    
    # Return user without password
    # Re-fetch user to get updated trial fields
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    
    # Build trial info if trial was started
    trial_info = None
    if trial_result and trial_result.get("started"):
        trial_info = {
            "active": True,
            "endsAt": trial_result.get("trial_ends"),
            "daysRemaining": trial_result.get("days_remaining", 7),
            "message": "🎉 Your 7-day premium trial has started!"
        }
    
    return Token(
        access_token=access_token, 
        token_type="bearer", 
        user=updated_user,
        trial=trial_info
    )


@router.post("/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": db_user["id"]})
    
    user_response = {k: v for k, v in db_user.items() if k not in ["hashed_password", "_id"]}
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)


@router.post("/phone/send-otp")
async def send_phone_otp(request: PhoneSendOTP):
    """Send OTP to phone number via Twilio SMS"""
    phone = request.phone_number.strip()
    
    # Validate E.164 format
    if not phone.startswith('+') or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number format. Use E.164 format: +1234567890")
    
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP locally (with expiration)
    otp_storage[phone] = {
        "code": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0
    }
    
    # Check if Twilio is configured
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    
    if twilio_sid and twilio_token:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            
            # Send SMS with OTP
            message = client.messages.create(
                body=f"Your MoodFood verification code is: {otp}. Valid for 10 minutes.",
                from_=TWILIO_FROM_NUMBER,
                to=phone
            )
            
            logging.info(f"SMS sent to {phone}, SID: {message.sid}, Status: {message.status}")
            
            return {
                "status": "pending",
                "message": "Verification code sent via SMS",
                "sid": message.sid
            }
        except Exception as e:
            logging.error(f"Twilio error: {e}")
            logging.info(f"Fallback - Demo OTP for {phone}: {otp}")
            return {
                "status": "pending",
                "message": "Demo mode: OTP generated (SMS failed, check server logs)",
                "demo_otp": otp
            }
    else:
        logging.info(f"Demo OTP for {phone}: {otp}")
        return {
            "status": "pending", 
            "message": "Demo mode: OTP generated (check server logs)",
            "demo_otp": otp
        }


@router.post("/phone/verify-otp", response_model=PhoneLoginResponse)
async def verify_phone_otp(request: PhoneVerifyOTP):
    """Verify OTP and login/register user"""
    phone = request.phone_number.strip()
    code = request.code.strip()
    
    is_valid = False
    
    # Verify against stored OTP
    if phone in otp_storage:
        stored = otp_storage[phone]
        if stored["expires"] > datetime.now(timezone.utc):
            stored["attempts"] += 1
            if stored["attempts"] > 5:
                del otp_storage[phone]
                raise HTTPException(status_code=400, detail="Too many attempts. Please request a new code.")
            if stored["code"] == code:
                is_valid = True
                del otp_storage[phone]
        else:
            del otp_storage[phone]
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new code.")
    else:
        raise HTTPException(status_code=400, detail="No OTP found for this number. Please request a code first.")
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Check if user exists
    existing_user = await db.users.find_one({"phone_number": phone}, {"_id": 0, "hashed_password": 0})
    is_new_user = False
    trial_result = None
    
    if existing_user:
        user_data = existing_user
    else:
        # Create new user with phone number - HARD DEFAULTS (MANDATORY)
        is_new_user = True
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "phone_number": phone,
            "email": None,
            "name": f"User-{phone[-4:]}",
            "dietary_restrictions": [],
            "cuisine_preferences": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            # === MANDATORY ENTITLEMENT DEFAULTS ===
            "default_plan": "free",           # ALWAYS "free"
            "subscription_status": "inactive", # ALWAYS "inactive"
            "trial_active": False,            # ALWAYS False (will be updated by auto-start)
            "entitlement_tier": "free",       # ALWAYS "free" (will be updated by auto-start)
            # === END MANDATORY DEFAULTS ===
        }
        await db.users.insert_one(new_user)
        new_user.pop('_id', None)
        user_data = new_user
        
        # LOG PHONE USER CREATION
        log_security_event(
            event_type=SecurityEvent.SUBSCRIPTION_CREATED,
            user_id=user_id,
            source="phone_signup",
            plan_id="free",
            details={
                "phone": phone[-4:],  # Last 4 digits only for privacy
                "action": "phone_user_registered",
                "default_plan": "free",
                "subscription_status": "inactive",
                "trial_active": False,
                "entitlement_tier": "free"
            }
        )
        
        # ============ AUTO-START TRIAL FOR NEW PHONE USERS ============
        try:
            # Detect platform from request if available
            platform = getattr(request, 'platform', 'mobile') or 'mobile'
            trial_result = await auto_start_trial_if_eligible(user_id, platform)
            if trial_result.get("started"):
                logging.info(f"✅ Trial auto-started for new phone user: {phone[-4:]}")
                # Re-fetch user to get updated trial fields
                user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
        except Exception as trial_error:
            logging.error(f"⚠️ Trial auto-start failed for phone user: {trial_error}")
            # Don't fail registration if trial fails
        # ==========================================
    
    # Generate JWT token
    token_data = {
        "sub": user_data["id"],
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    }
    access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    # Build response
    response = PhoneLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_data,
        is_new_user=is_new_user
    )
    
    # Add trial info to response for new users if trial started
    if is_new_user and trial_result and trial_result.get("started"):
        # Add trial info as extra data (PhoneLoginResponse doesn't have trial field)
        response.user["trial"] = {
            "active": True,
            "endsAt": trial_result.get("trial_ends"),
            "daysRemaining": trial_result.get("days_remaining", 7),
            "message": "🎉 Your 7-day premium trial has started!"
        }
    
    return response


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=User)
async def update_profile(data: dict, current_user: User = Depends(get_current_user)):
    allowed_fields = ["name", "dietary_restrictions", "cuisine_preferences", "phone_number", "whatsapp_notifications"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    return User(**updated_user)
