"""
Authentication routes - register, login, phone OTP, profile
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import random

from .deps import (
    db, User, UserRegister, UserLogin, Token, 
    PhoneSendOTP, PhoneVerifyOTP, PhoneLoginResponse,
    get_current_user, verify_password, get_password_hash, create_access_token,
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS
)
from ..services.entitlement_guard import (
    log_security_event,
    SecurityEvent
)
import jwt

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory OTP storage (use Redis in production)
otp_storage = {}

# Twilio phone number for sending SMS
TWILIO_FROM_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER', '+19064011655')


@router.post("/register", response_model=Token)
async def register(user: UserRegister):
    """
    SIGNUP HARD DEFAULT
    
    Immediately after user creation:
    SET:
        plan = FREE
        subscription_status = NONE
    
    User starts with NO subscription - premium requires payment.
    """
    # Check if user exists
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user.password)
    now = datetime.now(timezone.utc)
    
    user_data = {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "hashed_password": hashed_password,
        "dietary_restrictions": user.dietary_restrictions,
        "cuisine_preferences": user.cuisine_preferences,
        "created_at": now.isoformat(),
        # SIGNUP HARD DEFAULT: User starts with FREE plan, NO subscription
        "default_plan": "free",
        "subscription_status": "none"
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
            "subscription_status": "none"
        }
    )
    
    # Create token
    access_token = create_access_token({"sub": user_id})
    
    # Return user without password
    user_response = {k: v for k, v in user_data.items() if k != "hashed_password"}
    user_response.pop('_id', None)
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)


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
    
    if existing_user:
        user_data = existing_user
    else:
        # Create new user with phone number
        is_new_user = True
        new_user = {
            "id": str(uuid.uuid4()),
            "phone_number": phone,
            "email": None,
            "name": f"User-{phone[-4:]}",
            "dietary_restrictions": [],
            "cuisine_preferences": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        new_user.pop('_id', None)
        user_data = new_user
    
    # Generate JWT token
    token_data = {
        "sub": user_data["id"],
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    }
    access_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return PhoneLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_data,
        is_new_user=is_new_user
    )


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=User)
async def update_profile(data: dict, current_user: User = Depends(get_current_user)):
    allowed_fields = ["name", "dietary_restrictions", "cuisine_preferences"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "hashed_password": 0})
    return User(**updated_user)
