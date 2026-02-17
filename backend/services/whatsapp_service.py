"""
============================================================
WhatsApp Service for Family Plan

STATUS : DORMANT
REASON : Twilio WhatsApp Business API not yet approved
PHASE  : Will activate in Phase 2

TO REACTIVATE (Phase 2 checklist):
  1. Get WhatsApp Business API approved at business.whatsapp.com
  2. Replace sandbox number with approved production number
  3. Change line: self.DORMANT = False
  4. Set FAMILY_PLAN_WHATSAPP_ENABLED=true in .env
  5. Test all notification types before deploying

DO NOT DELETE THIS FILE — all logic is preserved below
============================================================
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


class WhatsAppService:
    def __init__(self):
        # ─────────────────────────────────────────
        # MASTER KILL SWITCH — keeps WhatsApp off
        # regardless of any .env value
        # Change to False ONLY when Phase 2 ready
        # ─────────────────────────────────────────
        self.DORMANT = True
        
        # Preserved — will be used when reactivated
        self.enabled = (not self.DORMANT and 
                       os.environ.get('FAMILY_PLAN_WHATSAPP_ENABLED', 'false').lower() == 'true')
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
                    logger.info("WhatsApp service initialized (will be dormant)")
                except Exception as e:
                    logger.error(f"Failed to initialize WhatsApp service: {e}")
                    self.enabled = False

    def is_enabled_for_user(self, user: Dict) -> bool:
        """
        Check if WhatsApp is enabled for this user.
        Always returns False when DORMANT.
        """
        if self.DORMANT:
            # Silent — no logs to avoid noise in production
            return False
        return self.enabled

    def format_phone_number(self, phone: str) -> Optional[str]:
        """Format phone number to E.164 format"""
        if not phone:
            return None
        
        # Remove all non-digits except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Ensure + at start
        if not cleaned.startswith('+'):
            cleaned = '+' + cleaned
        
        return cleaned

    async def send_message(self, to_phone_number: str, message: str) -> Dict[str, Any]:
        """Send WhatsApp message — returns dormant when inactive"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        
        try:
            if not self.enabled or not self.client:
                return {'success': False, 'reason': 'disabled'}
            
            formatted_number = self.format_phone_number(to_phone_number)
            
            if not formatted_number:
                return {'success': False, 'reason': 'invalid_number'}
            
            result = self.client.messages.create(
                from_=self.from_number,
                to=f"whatsapp:{formatted_number}",
                body=message
            )
            
            logger.info(f'WhatsApp sent: {result.sid}')
            return {'success': True, 'messageId': result.sid}
            
        except TwilioRestException as e:
            logger.error(f'WhatsApp Twilio error: {e.msg}')
            return {'success': False, 'reason': 'twilio_error', 'error': str(e.msg)}
        except Exception as e:
            logger.error(f'WhatsApp send error: {e}')
            return {'success': False, 'reason': 'send_failed', 'error': str(e)}

    async def send_family_invite(
        self, 
        phone_number: str, 
        invite_code: str, 
        family_name: str, 
        inviter_name: str
    ) -> Dict[str, Any]:
        """Send family invite via WhatsApp — DORMANT"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        
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
        """Send voting session notification — DORMANT"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        
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
        """Send voting reminder — DORMANT"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        
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
        """Send winner announcement — DORMANT"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        
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
        """Send custom message — DORMANT"""
        if self.DORMANT:
            return {'success': False, 'reason': 'dormant'}
        return await self.send_message(phone_number, message_text)


# Singleton instance
whatsapp_service = WhatsAppService()
