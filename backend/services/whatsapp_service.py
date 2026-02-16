"""
WhatsApp Service for Family Plan
Only activated for Family Plan users
Isolated from other features
"""
import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Twilio client
try:
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    logging.warning("Twilio not installed - WhatsApp service disabled")

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self):
        # Only initialize if Family Plan WhatsApp is enabled
        self.enabled = os.environ.get('FAMILY_PLAN_WHATSAPP_ENABLED', 'true').lower() == 'true'
        self.client = None
        self.from_number = None
        
        if self.enabled and TWILIO_AVAILABLE:
            account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
            whatsapp_number = os.environ.get('TWILIO_WHATSAPP_NUMBER', '+14155238886')
            
            if account_sid and auth_token:
                try:
                    self.client = Client(account_sid, auth_token)
                    self.from_number = f"whatsapp:{whatsapp_number}"
                    logger.info("WhatsApp service initialized successfully")
                except Exception as e:
                    logger.error(f"Failed to initialize WhatsApp service: {e}")
                    self.enabled = False
            else:
                logger.warning("Twilio credentials not configured - WhatsApp disabled")
                self.enabled = False

    def is_enabled_for_user(self, user: Dict) -> bool:
        """Check if WhatsApp is enabled for this user - Only for Family Plan users"""
        if not self.enabled or not self.client:
            return False
        
        # Check if user is on Family Plan
        plan = user.get('plan') or user.get('default_plan') or 'free'
        return 'family' in plan.lower()

    def format_phone_number(self, phone: str) -> Optional[str]:
        """Format phone number to E.164 format"""
        if not phone:
            return None
        
        # Remove all non-digits except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Ensure + at start
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        # Basic validation (E.164 is 8-15 digits after +)
        digits_only = cleaned.replace('+', '')
        if len(digits_only) < 8 or len(digits_only) > 15:
            return None
        
        return cleaned

    async def send_message(self, to_phone_number: str, message: str) -> Dict[str, Any]:
        """Send WhatsApp message (with safety checks)"""
        try:
            # Safety check - only send if enabled
            if not self.enabled or not self.client:
                logger.info('WhatsApp disabled globally - skipping')
                return {'success': False, 'reason': 'disabled'}
            
            # Format phone number
            formatted_number = self.format_phone_number(to_phone_number)
            
            if not formatted_number:
                logger.info(f'Invalid phone number {to_phone_number} - skipping WhatsApp')
                return {'success': False, 'reason': 'invalid_number'}
            
            # Send message via Twilio
            result = self.client.messages.create(
                from_=self.from_number,
                to=f"whatsapp:{formatted_number}",
                body=message
            )
            
            logger.info(f'WhatsApp sent: {result.sid}')
            
            return {
                'success': True,
                'message_id': result.sid,
                'status': result.status
            }
            
        except TwilioRestException as e:
            logger.error(f'WhatsApp Twilio error: {e.msg}')
            return {
                'success': False,
                'reason': 'twilio_error',
                'error': str(e.msg)
            }
        except Exception as e:
            logger.error(f'WhatsApp send error: {e}')
            # Don't throw - fail gracefully
            return {
                'success': False,
                'reason': 'send_failed',
                'error': str(e)
            }

    async def send_family_invite(
        self, 
        phone_number: str, 
        invite_code: str, 
        family_name: str, 
        inviter_name: str
    ) -> Dict[str, Any]:
        """Send family invite via WhatsApp"""
        message = f"""🎉 *Family Invite - MoodFood*

{inviter_name} has invited you to join *{family_name}* on MoodFood!

With Family Plan, you can:
• Vote on recipes together
• Decide what to cook democratically
• Get real-time updates

*Your Invite Code:* {invite_code}

Download MoodFood and join the family!
📱 Join using code: {invite_code}"""
        
        return await self.send_message(phone_number, message)

    async def send_voting_notification(
        self, 
        phone_number: str, 
        session: Dict, 
        family_name: str
    ) -> Dict[str, Any]:
        """Send voting session notification"""
        meal_type_emoji = {
            'breakfast': '🍳',
            'lunch': '🥗',
            'dinner': '🍽️',
            'snack': '🍪'
        }
        
        meal_type = session.get('meal_type', 'meal')
        emoji = meal_type_emoji.get(meal_type.lower(), '🍴')
        
        recipe_count = len(session.get('recipe_options', []))
        meal_date = session.get('meal_date', 'today')
        expires_at = session.get('expires_at', '')
        session_id = session.get('id', session.get('_id', ''))
        
        message = f"""{emoji} *Time to Vote!*

*{family_name}* is deciding what to cook for {meal_type}!

📅 Meal Date: {meal_date}
🗳️ {recipe_count} options to choose from
⏰ Vote before the session ends

Cast your vote now in the MoodFood app!"""
        
        return await self.send_message(phone_number, message)

    async def send_voting_reminder(
        self, 
        phone_number: str, 
        session: Dict, 
        family_name: str, 
        hours_left: int
    ) -> Dict[str, Any]:
        """Send voting reminder (if user hasn't voted)"""
        meal_type = session.get('meal_type', 'meal')
        
        message = f"""⏰ *Voting Reminder*

Don't forget to vote for {meal_type} in *{family_name}*!

Only {hours_left} hours left to vote!

Cast your vote now in the MoodFood app!"""
        
        return await self.send_message(phone_number, message)

    async def send_winner_announcement(
        self, 
        phone_number: str, 
        winner_recipe: Dict, 
        session: Dict, 
        family_name: str, 
        vote_count: int
    ) -> Dict[str, Any]:
        """Send winner announcement"""
        recipe_name = winner_recipe.get('title') or winner_recipe.get('name', 'Selected Recipe')
        cooking_time = winner_recipe.get('totalTime') or winner_recipe.get('cooking_time', 'N/A')
        
        message = f"""🏆 *Winner Announced!*

*{family_name}* has decided!

🍽️ We're cooking: *{recipe_name}*
📊 {vote_count} votes
⏱️ Cooking time: {cooking_time}

View recipe details in the MoodFood app!

Happy cooking! 👨‍🍳"""
        
        return await self.send_message(phone_number, message)

    async def send_custom_message(
        self, 
        phone_number: str, 
        message_text: str
    ) -> Dict[str, Any]:
        """Send custom message"""
        return await self.send_message(phone_number, message_text)


# Singleton instance
whatsapp_service = WhatsAppService()
