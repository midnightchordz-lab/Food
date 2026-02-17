"""
Notification Router — Phase 1
Tries push first. Falls back to SMS if push fails.
Family Plan only via subscription check.
Zero impact on existing features.
"""
import logging
from typing import Dict, Any, List, Optional

from .push_notification_service import push_notification_service
from .sms_service import sms_service

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Routes notifications to the appropriate channel.
    Push first, SMS fallback.
    Only for Family Plan users.
    """

    async def notify_user(
        self, 
        fcm_token: Optional[str], 
        phone_number: Optional[str],
        push_payload: Dict[str, Any], 
        sms_fallback_text: str
    ) -> Dict[str, Any]:
        """
        Route one notification to a single user.
        Tries push first, falls back to SMS.
        """
        # Try push first
        if fcm_token:
            result = await push_notification_service.send_to_user(fcm_token, push_payload)
            if result.get("success"):
                return {"channel": "push", "success": True}
        
        # Fallback: SMS
        if phone_number:
            result = await sms_service.send(phone_number, sms_fallback_text)
            if result.get("success"):
                return {"channel": "sms", "success": True}
        
        return {"channel": "none", "success": False}

    # ── TRIGGER 1 ─────────────────────────────────────
    # Call from: POST /api/family/join (after member added)
    # ──────────────────────────────────────────────────
    async def on_member_joined(
        self, 
        cook_fcm_token: Optional[str],
        cook_phone: Optional[str],
        new_member_name: str, 
        family_name: str
    ) -> Dict[str, Any]:
        """Notify cook when a new member joins their family"""
        try:
            push_payload = {
                "title": f"👋 New member — {family_name}",
                "body": f"{new_member_name} joined your family!",
                "type": "member_joined"
            }
            sms_text = f"👋 {family_name}: {new_member_name} joined your family!"
            
            return await self.notify_user(cook_fcm_token, cook_phone, push_payload, sms_text)
        except Exception as e:
            logger.error(f"on_member_joined error: {e}")
            return {"success": False, "error": str(e)}

    # ── TRIGGER 2 ─────────────────────────────────────
    # Call from: POST /api/family/voting/create (after session saved)
    # ──────────────────────────────────────────────────
    async def on_voting_started(
        self,
        members: List[Dict],  # List of {fcm_token, phone_number, user_id}
        session: Dict,
        family_name: str,
        creator_id: str
    ) -> Dict[str, Any]:
        """Notify family members when a voting session starts (except creator)"""
        try:
            results = []
            recipe_count = len(session.get("recipe_options", []))
            meal_type = session.get("meal_type", "meal")
            session_id = session.get("id", "")
            
            for member in members:
                # Skip the creator
                if member.get("user_id") == creator_id:
                    continue
                
                push_payload = {
                    "title": f"🗳️ Time to vote — {family_name}",
                    "body": f"{recipe_count} recipes for {meal_type}. Vote now!",
                    "type": "voting_session",
                    "sessionId": session_id
                }
                sms_text = f"🗳️ {family_name}: Vote for {meal_type}! Open MoodFood to vote."
                
                result = await self.notify_user(
                    member.get("fcm_token"),
                    member.get("phone_number"),
                    push_payload,
                    sms_text
                )
                results.append(result)
            
            sent = sum(1 for r in results if r.get("success"))
            return {"sent": sent, "total": len(results)}
            
        except Exception as e:
            logger.error(f"on_voting_started error: {e}")
            return {"success": False, "error": str(e)}

    # ── TRIGGER 3 ─────────────────────────────────────
    # Call from: POST /api/family/voting/complete (after winner set)
    # ──────────────────────────────────────────────────
    async def on_winner_announced(
        self,
        members: List[Dict],  # List of {fcm_token, phone_number, user_id}
        winner_recipe: Dict,
        vote_count: int,
        family_name: str
    ) -> Dict[str, Any]:
        """Notify all family members when voting winner is announced"""
        try:
            results = []
            recipe_name = winner_recipe.get("title") or winner_recipe.get("name", "Selected Recipe")
            recipe_id = winner_recipe.get("id", "")
            
            for member in members:
                push_payload = {
                    "title": f"🏆 {recipe_name} wins — {family_name}",
                    "body": f"{vote_count} votes. Open MoodFood for the recipe!",
                    "type": "winner_announcement",
                    "recipeId": recipe_id
                }
                sms_text = f"🏆 {family_name}: Tonight's dinner is {recipe_name}! Open MoodFood for the recipe."
                
                result = await self.notify_user(
                    member.get("fcm_token"),
                    member.get("phone_number"),
                    push_payload,
                    sms_text
                )
                results.append(result)
            
            sent = sum(1 for r in results if r.get("success"))
            return {"sent": sent, "total": len(results)}
            
        except Exception as e:
            logger.error(f"on_winner_announced error: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
notification_service = NotificationService()
