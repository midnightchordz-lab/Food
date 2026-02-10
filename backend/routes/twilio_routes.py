from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from datetime import datetime
import os
import random
import string

from .deps import db, get_current_user

router = APIRouter(prefix="/api/twilio", tags=["Twilio"])

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '+14155238886')

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# Request/Response Models
class SendOTPRequest(BaseModel):
    phone_number: str  # E.164 format: +1234567890

class VerifyOTPRequest(BaseModel):
    phone_number: str
    code: str

class WhatsAppMessageRequest(BaseModel):
    phone_number: str  # E.164 format: +1234567890
    message: str

class SendMealPlanRequest(BaseModel):
    phone_number: str
    week_start: str  # Format: YYYY-MM-DD

# ============== PHONE VERIFICATION (OTP) ==============

@router.post("/send-otp")
async def send_otp(request: SendOTPRequest):
    """Send OTP to phone number for verification"""
    if not twilio_client:
        raise HTTPException(status_code=500, detail="Twilio not configured")
    
    try:
        # Generate 6-digit OTP
        otp_code = ''.join(random.choices(string.digits, k=6))
        
        # Store OTP in database with expiration
        await db.otp_verifications.update_one(
            {"phone_number": request.phone_number},
            {
                "$set": {
                    "phone_number": request.phone_number,
                    "code": otp_code,
                    "created_at": datetime.utcnow(),
                    "verified": False,
                    "attempts": 0
                }
            },
            upsert=True
        )
        
        # Send SMS via Twilio
        message = twilio_client.messages.create(
            body=f"Your MOOD FOOD verification code is: {otp_code}. Valid for 10 minutes.",
            from_=TWILIO_PHONE_NUMBER,
            to=request.phone_number
        )
        
        return {
            "success": True,
            "message": "OTP sent successfully",
            "sid": message.sid
        }
        
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to send OTP: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending OTP: {str(e)}")

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    """Verify OTP code"""
    try:
        # Find OTP record
        otp_record = await db.otp_verifications.find_one({
            "phone_number": request.phone_number,
            "verified": False
        })
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="No pending verification found")
        
        # Check attempts
        if otp_record.get("attempts", 0) >= 3:
            raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
        
        # Check expiration (10 minutes)
        created_at = otp_record.get("created_at")
        if created_at:
            time_diff = (datetime.utcnow() - created_at).total_seconds()
            if time_diff > 600:  # 10 minutes
                raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        
        # Verify code
        if otp_record.get("code") == request.code:
            # Mark as verified
            await db.otp_verifications.update_one(
                {"phone_number": request.phone_number},
                {"$set": {"verified": True, "verified_at": datetime.utcnow()}}
            )
            return {"valid": True, "message": "Phone number verified successfully"}
        else:
            # Increment attempts
            await db.otp_verifications.update_one(
                {"phone_number": request.phone_number},
                {"$inc": {"attempts": 1}}
            )
            return {"valid": False, "message": "Invalid OTP code"}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verifying OTP: {str(e)}")

# ============== WHATSAPP MESSAGES ==============

@router.post("/whatsapp/send")
async def send_whatsapp_message(request: WhatsAppMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a WhatsApp message"""
    if not twilio_client:
        raise HTTPException(status_code=500, detail="Twilio not configured")
    
    try:
        # WhatsApp numbers need 'whatsapp:' prefix
        whatsapp_to = f"whatsapp:{request.phone_number}"
        whatsapp_from = f"whatsapp:{TWILIO_WHATSAPP_NUMBER}"
        
        message = twilio_client.messages.create(
            body=request.message,
            from_=whatsapp_from,
            to=whatsapp_to
        )
        
        # Log the message
        await db.whatsapp_messages.insert_one({
            "user_id": current_user["user_id"],
            "to": request.phone_number,
            "message": request.message,
            "sid": message.sid,
            "status": message.status,
            "sent_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": "WhatsApp message sent",
            "sid": message.sid
        }
        
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to send WhatsApp: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending WhatsApp: {str(e)}")

@router.post("/whatsapp/send-meal-plan")
async def send_meal_plan_whatsapp(request: SendMealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Send weekly meal plan via WhatsApp"""
    if not twilio_client:
        raise HTTPException(status_code=500, detail="Twilio not configured")
    
    try:
        # Get user's meal plan for the week
        meal_plan = await db.weekly_plans.find_one({
            "user_id": current_user["user_id"],
            "week_start_date": request.week_start
        })
        
        if not meal_plan:
            raise HTTPException(status_code=404, detail="No meal plan found for this week")
        
        # Format meal plan message
        message_lines = [
            f"🍽️ *MOOD FOOD - Your Meal Plan*",
            f"📅 Week of {request.week_start}",
            ""
        ]
        
        meals = meal_plan.get("meals", {})
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for day in day_names:
            day_meals = meals.get(day.lower(), {})
            if day_meals:
                message_lines.append(f"*{day}*")
                if day_meals.get("breakfast"):
                    breakfast = day_meals["breakfast"]
                    if isinstance(breakfast, str):
                        message_lines.append(f"🌅 Breakfast: {breakfast[:50]}")
                    elif isinstance(breakfast, dict):
                        message_lines.append(f"🌅 Breakfast: {breakfast.get('title', 'Meal')[:50]}")
                if day_meals.get("lunch"):
                    lunch = day_meals["lunch"]
                    if isinstance(lunch, str):
                        message_lines.append(f"☀️ Lunch: {lunch[:50]}")
                    elif isinstance(lunch, dict):
                        message_lines.append(f"☀️ Lunch: {lunch.get('title', 'Meal')[:50]}")
                if day_meals.get("dinner"):
                    dinner = day_meals["dinner"]
                    if isinstance(dinner, str):
                        message_lines.append(f"🌙 Dinner: {dinner[:50]}")
                    elif isinstance(dinner, dict):
                        message_lines.append(f"🌙 Dinner: {dinner.get('title', 'Meal')[:50]}")
                message_lines.append("")
        
        message_lines.append("Enjoy your meals! 🥗")
        full_message = "\n".join(message_lines)
        
        # Send via WhatsApp
        whatsapp_to = f"whatsapp:{request.phone_number}"
        whatsapp_from = f"whatsapp:{TWILIO_WHATSAPP_NUMBER}"
        
        message = twilio_client.messages.create(
            body=full_message,
            from_=whatsapp_from,
            to=whatsapp_to
        )
        
        # Log the message
        await db.whatsapp_messages.insert_one({
            "user_id": current_user["user_id"],
            "to": request.phone_number,
            "type": "meal_plan",
            "week_start": request.week_start,
            "sid": message.sid,
            "status": message.status,
            "sent_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": "Meal plan sent via WhatsApp",
            "sid": message.sid
        }
        
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to send WhatsApp: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending meal plan: {str(e)}")

# ============== USER PHONE MANAGEMENT ==============

@router.post("/link-phone")
async def link_phone_to_account(request: SendOTPRequest, current_user: dict = Depends(get_current_user)):
    """Link a verified phone number to user account"""
    try:
        # Check if phone is verified
        otp_record = await db.otp_verifications.find_one({
            "phone_number": request.phone_number,
            "verified": True
        })
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="Phone number not verified. Please verify first.")
        
        # Update user with phone number
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {
                "$set": {
                    "phone_number": request.phone_number,
                    "phone_verified": True,
                    "phone_verified_at": otp_record.get("verified_at")
                }
            }
        )
        
        return {
            "success": True,
            "message": "Phone number linked to your account"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error linking phone: {str(e)}")

@router.get("/phone-status")
async def get_phone_status(current_user: dict = Depends(get_current_user)):
    """Get user's phone verification status"""
    try:
        user = await db.users.find_one(
            {"user_id": current_user["user_id"]},
            {"phone_number": 1, "phone_verified": 1}
        )
        
        return {
            "phone_number": user.get("phone_number"),
            "verified": user.get("phone_verified", False)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting phone status: {str(e)}")
