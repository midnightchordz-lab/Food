"""
SMS Service — Phase 1 Fallback
Only fires when push fails and user has phone number.
Family Plan only. Does not affect any other feature.
"""
import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Twilio client
try:
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    logger.warning("Twilio not installed - SMS service disabled")


class SMSService:
    def __init__(self):
        self.enabled = os.environ.get('SMS_ENABLED', 'false').lower() == 'true'
        self.client = None
        self.from_number = None
        
        if self.enabled and TWILIO_AVAILABLE:
            account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
            # Regular SMS number, NOT WhatsApp
            self.from_number = os.environ.get('TWILIO_PHONE_NUMBER')
            
            if account_sid and auth_token and self.from_number:
                try:
                    self.client = Client(account_sid, auth_token)
                    logger.info("SMS service initialized successfully")
                except Exception as e:
                    logger.error(f"SMS service init failed: {e}")
                    self.enabled = False
            else:
                logger.warning("Twilio SMS credentials not configured")
                self.enabled = False

    def format_phone(self, phone: str) -> Optional[str]:
        """Format phone number to E.164 format"""
        if not phone:
            return None
        
        # Remove all non-digits except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Ensure + at start
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        # Basic validation
        digits_only = cleaned.replace('+', '')
        if len(digits_only) < 8 or len(digits_only) > 15:
            return None
        
        return cleaned

    async def send(self, phone_number: str, text: str) -> Dict[str, Any]:
        """Send SMS message"""
        if not self.enabled or not self.client:
            return {"success": False, "reason": "sms_disabled"}
        
        try:
            to = self.format_phone(phone_number)
            if not to:
                return {"success": False, "reason": "invalid_phone"}
            
            result = self.client.messages.create(
                body=text,
                from_=self.from_number,
                to=to
            )
            
            logger.info(f"SMS sent: {result.sid}")
            return {"success": True, "messageId": result.sid}
            
        except TwilioRestException as e:
            logger.error(f"SMS Twilio error: {e.msg}")
            return {"success": False, "reason": "twilio_error", "error": str(e.msg)}
        except Exception as e:
            logger.error(f"SMS send error: {e}")
            return {"success": False, "reason": "send_failed", "error": str(e)}

    async def voting_started(self, phone: str, session: Dict, family_name: str) -> Dict[str, Any]:
        """Send SMS notification for voting session start"""
        meal_type = session.get("meal_type", "meal")
        return await self.send(
            phone,
            f"🗳️ {family_name}: Vote for {meal_type}! Open MoodFood to vote."
        )

    async def winner_announced(self, phone: str, winner_recipe: Dict, family_name: str) -> Dict[str, Any]:
        """Send SMS notification for winner announcement"""
        recipe_name = winner_recipe.get("title") or winner_recipe.get("name", "dinner")
        return await self.send(
            phone,
            f"🏆 {family_name}: Tonight's dinner is {recipe_name}! Open MoodFood for the recipe."
        )

    async def member_joined(self, phone: str, new_member_name: str, family_name: str) -> Dict[str, Any]:
        """Send SMS notification when member joins"""
        return await self.send(
            phone,
            f"👋 {family_name}: {new_member_name} joined your family!"
        )


# Singleton instance
sms_service = SMSService()
