"""
Push Notification Service — Phase 1
Family Plan only. Uses subscription check for Family Plan access.
Does not affect any other feature.
"""
import os
import json
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    logger.warning("firebase-admin not installed - Push notifications disabled")


class PushNotificationService:
    def __init__(self):
        self.enabled = os.environ.get('PUSH_NOTIFICATIONS_ENABLED', 'false').lower() == 'true'
        self.initialized = False
        
        if self.enabled and FIREBASE_AVAILABLE:
            try:
                service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
                if service_account_json:
                    service_account = json.loads(service_account_json)
                    if not firebase_admin._apps:
                        cred = credentials.Certificate(service_account)
                        firebase_admin.initialize_app(cred)
                    self.initialized = True
                    logger.info("Firebase Push Notification service initialized")
                else:
                    logger.warning("FIREBASE_SERVICE_ACCOUNT not set - Push disabled")
                    self.enabled = False
            except Exception as e:
                logger.error(f"Firebase init failed: {e}")
                self.enabled = False

    async def send_to_user(self, fcm_token: str, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send push notification to a single user"""
        if not self.enabled or not self.initialized:
            return {"success": False, "reason": "push_disabled"}
        
        if not fcm_token:
            return {"success": False, "reason": "no_token"}
        
        try:
            message = messaging.Message(
                token=fcm_token,
                notification=messaging.Notification(
                    title=notification.get("title", ""),
                    body=notification.get("body", "")
                ),
                data={
                    "type": notification.get("type", "general"),
                    "sessionId": notification.get("sessionId", ""),
                    "recipeId": notification.get("recipeId", "")
                },
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(sound="default")
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                )
            )
            
            result = messaging.send(message)
            logger.info(f"Push notification sent: {result}")
            return {"success": True, "messageId": result}
            
        except messaging.UnregisteredError:
            # Token is invalid/expired
            logger.warning(f"FCM token expired/invalid")
            return {"success": False, "reason": "token_expired", "should_clear": True}
        except Exception as e:
            logger.error(f"Push notification error: {e}")
            return {"success": False, "reason": "send_failed", "error": str(e)}

    async def send_to_many(self, tokens_with_data: List[Dict]) -> Dict[str, Any]:
        """Send push notifications to multiple users"""
        if not self.enabled or not self.initialized:
            return {"sent": 0, "total": len(tokens_with_data), "reason": "push_disabled"}
        
        results = []
        for item in tokens_with_data:
            result = await self.send_to_user(item.get("token"), item.get("notification"))
            results.append(result)
        
        return {
            "sent": sum(1 for r in results if r.get("success")),
            "total": len(tokens_with_data),
            "results": results
        }

    # TRIGGER 1: Cook notified when member joins
    async def member_joined(self, cook_fcm_token: str, new_member_name: str, family_name: str) -> Dict[str, Any]:
        """Notify cook when a new member joins the family"""
        return await self.send_to_user(cook_fcm_token, {
            "title": f"👋 New member — {family_name}",
            "body": f"{new_member_name} joined your family!",
            "type": "member_joined"
        })

    # TRIGGER 2: Members notified when voting starts
    async def voting_started(self, member_tokens: List[str], session: Dict, family_name: str) -> Dict[str, Any]:
        """Notify family members when a voting session starts"""
        notification = {
            "title": f"🗳️ Time to vote — {family_name}",
            "body": f"{len(session.get('recipe_options', []))} recipes for {session.get('meal_type', 'meal')}. Vote now!",
            "type": "voting_session",
            "sessionId": session.get("id", "")
        }
        
        tokens_with_data = [{"token": t, "notification": notification} for t in member_tokens if t]
        return await self.send_to_many(tokens_with_data)

    # TRIGGER 3: Everyone notified when winner is announced
    async def winner_announced(self, member_tokens: List[str], winner_recipe: Dict, vote_count: int, family_name: str) -> Dict[str, Any]:
        """Notify all family members when voting winner is announced"""
        recipe_name = winner_recipe.get("title") or winner_recipe.get("name", "Selected Recipe")
        notification = {
            "title": f"🏆 {recipe_name} wins — {family_name}",
            "body": f"{vote_count} votes. Open MoodFood for the recipe!",
            "type": "winner_announcement",
            "recipeId": winner_recipe.get("id", "")
        }
        
        tokens_with_data = [{"token": t, "notification": notification} for t in member_tokens if t]
        return await self.send_to_many(tokens_with_data)


# Singleton instance
push_notification_service = PushNotificationService()
