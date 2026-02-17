"""
Family Plan Routes - Family accounts, voting, and notifications
Phase 1: Push Notifications + SMS Fallback (WhatsApp dormant)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .deps import db, User, get_current_user
from services.whatsapp_service import whatsapp_service
from services.notification_service import notification_service

router = APIRouter(prefix="/family", tags=["Family"])

logger = logging.getLogger(__name__)


# ============== MODELS ==============

class CreateFamilyRequest(BaseModel):
    family_name: str
    max_members: int = 5
    invite_phone_numbers: Optional[List[str]] = None  # Phone numbers to invite via WhatsApp


class JoinFamilyRequest(BaseModel):
    invite_code: str


class SendInvitesRequest(BaseModel):
    phone_numbers: List[str]


class CreateVotingSessionRequest(BaseModel):
    meal_type: str  # breakfast, lunch, dinner, snack
    meal_date: str  # YYYY-MM-DD
    recipe_ids: List[str]  # Recipe IDs to vote on
    expires_in_hours: int = 24


class CastVoteRequest(BaseModel):
    recipe_id: str


class UpdateWhatsAppSettingsRequest(BaseModel):
    enabled: bool = True
    voting_reminders: bool = True
    winner_announcements: bool = True
    family_invites: bool = True


# ============== HELPER FUNCTIONS ==============

def generate_invite_code() -> str:
    """Generate a unique 8-character invite code"""
    return uuid.uuid4().hex[:8].upper()


async def get_family_members(family_id: str) -> List[Dict]:
    """Get all members of a family"""
    members = await db.users.find(
        {"family_account.family_id": family_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone_number": 1, "whatsapp_notifications": 1}
    ).to_list(length=100)
    return members


async def is_family_plan_user(user_id: str) -> bool:
    """Check if user is on Family Plan"""
    # Check subscription
    subscription = await db.user_subscriptions.find_one({
        "user_id": user_id,
        "status": {"$in": ["active", "trialing"]},
        "plan_id": {"$regex": "family", "$options": "i"}
    })
    return subscription is not None


# ============== FAMILY ACCOUNT ROUTES ==============

@router.post("/create")
async def create_family_account(
    request: CreateFamilyRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a family account + Send invites via WhatsApp"""
    try:
        # Check if user is on Family Plan
        if not await is_family_plan_user(current_user.id):
            raise HTTPException(
                status_code=403, 
                detail="Family features require Family Plan subscription"
            )
        
        # Check if user already has a family account
        existing = await db.users.find_one({
            "id": current_user.id,
            "family_account.family_id": {"$exists": True}
        })
        
        if existing and existing.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You already have a family account")
        
        now = datetime.now(timezone.utc)
        family_id = str(uuid.uuid4())
        invite_code = generate_invite_code()
        
        # Create family account in user document
        family_account = {
            "family_id": family_id,
            "family_name": request.family_name,
            "invite_code": invite_code,
            "role": "owner",
            "max_members": request.max_members,
            "created_at": now.isoformat()
        }
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"family_account": family_account}}
        )
        
        # Create family document
        family_doc = {
            "id": family_id,
            "name": request.family_name,
            "owner_id": current_user.id,
            "invite_code": invite_code,
            "max_members": request.max_members,
            "members": [{
                "user_id": current_user.id,
                "name": current_user.name,
                "role": "owner",
                "joined_at": now.isoformat()
            }],
            "created_at": now.isoformat()
        }
        
        await db.families.insert_one(family_doc)
        
        # ========== WHATSAPP INTEGRATION ==========
        whatsapp_sent = False
        whatsapp_results = []
        
        # Check subscription for WhatsApp features
        has_family_plan = await is_family_plan_user(current_user.id)
        
        if has_family_plan and whatsapp_service.enabled:
            # Send invites to phone numbers if provided
            if request.invite_phone_numbers:
                for phone in request.invite_phone_numbers:
                    result = await whatsapp_service.send_family_invite(
                        phone,
                        invite_code,
                        request.family_name,
                        current_user.name
                    )
                    whatsapp_results.append({
                        "phone": phone[-4:],  # Last 4 digits for privacy
                        "success": result.get("success", False)
                    })
                
                whatsapp_sent = any(r["success"] for r in whatsapp_results)
                logger.info(f"WhatsApp invites sent to {len(request.invite_phone_numbers)} numbers")
        # ==========================================
        
        return {
            "success": True,
            "message": "Family account created",
            "family": {
                "id": family_id,
                "name": request.family_name,
                "invite_code": invite_code,
                "max_members": request.max_members
            },
            "whatsapp_sent": whatsapp_sent,
            "whatsapp_results": whatsapp_results if whatsapp_results else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create family error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create family account")


@router.post("/join")
async def join_family(
    request: JoinFamilyRequest,
    current_user: User = Depends(get_current_user)
):
    """Join a family using invite code"""
    try:
        # Find family by invite code
        family = await db.families.find_one({"invite_code": request.invite_code.upper()})
        
        if not family:
            raise HTTPException(status_code=404, detail="Invalid invite code")
        
        # Check if already a member
        existing_member = next(
            (m for m in family.get("members", []) if m["user_id"] == current_user.id),
            None
        )
        if existing_member:
            raise HTTPException(status_code=400, detail="You are already a member of this family")
        
        # Check max members
        if len(family.get("members", [])) >= family.get("max_members", 5):
            raise HTTPException(status_code=400, detail="Family has reached maximum members")
        
        now = datetime.now(timezone.utc)
        
        # Add member to family
        new_member = {
            "user_id": current_user.id,
            "name": current_user.name,
            "role": "member",
            "joined_at": now.isoformat()
        }
        
        await db.families.update_one(
            {"id": family["id"]},
            {"$push": {"members": new_member}}
        )
        
        # Update user's family account
        family_account = {
            "family_id": family["id"],
            "family_name": family["name"],
            "invite_code": family["invite_code"],
            "role": "member",
            "joined_at": now.isoformat()
        }
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"family_account": family_account}}
        )
        
        # ========== PHASE 1: NOTIFY COOK ==========
        # Get the family owner (cook) to notify them
        owner_id = family.get("owner_id")
        if owner_id:
            cook = await db.users.find_one({"id": owner_id}, {"_id": 0, "fcm_token": 1, "phone_number": 1})
            if cook:
                await notification_service.on_member_joined(
                    cook.get("fcm_token"),
                    cook.get("phone_number"),
                    current_user.name,
                    family["name"]
                )
        # ==========================================
        
        return {
            "success": True,
            "message": f"Successfully joined {family['name']}",
            "family": {
                "id": family["id"],
                "name": family["name"],
                "members_count": len(family.get("members", [])) + 1
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Join family error: {e}")
        raise HTTPException(status_code=500, detail="Failed to join family")


@router.get("/my-family")
async def get_my_family(current_user: User = Depends(get_current_user)):
    """Get current user's family details"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            return {
                "success": True,
                "has_family": False,
                "family": None
            }
        
        family_id = user["family_account"]["family_id"]
        family = await db.families.find_one({"id": family_id}, {"_id": 0})
        
        if not family:
            return {
                "success": True,
                "has_family": False,
                "family": None
            }
        
        return {
            "success": True,
            "has_family": True,
            "family": {
                "id": family["id"],
                "name": family["name"],
                "invite_code": family["invite_code"],
                "members": family.get("members", []),
                "max_members": family.get("max_members", 5),
                "role": user["family_account"].get("role", "member")
            }
        }
        
    except Exception as e:
        logger.error(f"Get family error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get family details")


@router.post("/send-invites")
async def send_family_invites(
    request: SendInvitesRequest,
    current_user: User = Depends(get_current_user)
):
    """Send WhatsApp invites to join family"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You don't have a family account")
        
        family_account = user["family_account"]
        invite_code = family_account.get("invite_code")
        family_name = family_account.get("family_name")
        
        if not invite_code:
            raise HTTPException(status_code=400, detail="No invite code found")
        
        # Check subscription instead of user dict
        if not await is_family_plan_user(current_user.id):
            raise HTTPException(
                status_code=403, 
                detail="WhatsApp notifications require Family Plan"
            )
        
        results = []
        for phone in request.phone_numbers:
            result = await whatsapp_service.send_family_invite(
                phone,
                invite_code,
                family_name,
                current_user.name
            )
            results.append({
                "phone": phone[-4:],
                "success": result.get("success", False),
                "error": result.get("error") if not result.get("success") else None
            })
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "success": True,
            "message": f"Invites sent to {success_count}/{len(request.phone_numbers)} numbers",
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send invites error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send invites")


@router.post("/send-sms-invites")
async def send_sms_invites(
    request: SendInvitesRequest,
    current_user: User = Depends(get_current_user)
):
    """Send SMS invites to join family (Phase 1 - WhatsApp dormant)"""
    from services.sms_service import sms_service
    
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You don't have a family account")
        
        family_account = user["family_account"]
        invite_code = family_account.get("invite_code")
        family_name = family_account.get("family_name")
        
        if not invite_code:
            raise HTTPException(status_code=400, detail="No invite code found")
        
        # Check subscription
        if not await is_family_plan_user(current_user.id):
            raise HTTPException(
                status_code=403, 
                detail="SMS invites require Family Plan"
            )
        
        results = []
        for phone in request.phone_numbers:
            sms_text = f"Join {family_name} on MoodFood! Use invite code: {invite_code}. Download app and enter code to join."
            result = await sms_service.send(phone, sms_text)
            results.append({
                "phone": phone[-4:],
                "success": result.get("success", False),
                "error": result.get("error") if not result.get("success") else None
            })
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "success": True,
            "message": f"SMS invites sent to {success_count}/{len(request.phone_numbers)} numbers",
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send SMS invites error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send SMS invites")


@router.delete("/leave")
async def leave_family(current_user: User = Depends(get_current_user)):
    """Leave the current family"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You're not in a family")
        
        family_id = user["family_account"]["family_id"]
        role = user["family_account"].get("role")
        
        if role == "owner":
            raise HTTPException(
                status_code=400, 
                detail="Family owner cannot leave. Transfer ownership or delete the family."
            )
        
        # Remove from family members
        await db.families.update_one(
            {"id": family_id},
            {"$pull": {"members": {"user_id": current_user.id}}}
        )
        
        # Clear user's family account
        await db.users.update_one(
            {"id": current_user.id},
            {"$unset": {"family_account": ""}}
        )
        
        return {
            "success": True,
            "message": "You have left the family"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Leave family error: {e}")
        raise HTTPException(status_code=500, detail="Failed to leave family")


# ============== VOTING ROUTES ==============

@router.post("/voting/create")
async def create_voting_session(
    request: CreateVotingSessionRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a voting session + Notify family via WhatsApp"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You need a family account to create voting sessions")
        
        family_id = user["family_account"]["family_id"]
        family = await db.families.find_one({"id": family_id}, {"_id": 0})
        
        if not family:
            raise HTTPException(status_code=404, detail="Family not found")
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=request.expires_in_hours)
        session_id = str(uuid.uuid4())
        
        # Get recipe details
        recipes = await db.recipes.find(
            {"id": {"$in": request.recipe_ids}},
            {"_id": 0, "id": 1, "title": 1, "image_url": 1, "totalTime": 1}
        ).to_list(length=10)
        
        # If no recipes found in recipes collection, try recipe_library
        if not recipes:
            recipes = await db.recipe_library.find(
                {"id": {"$in": request.recipe_ids}},
                {"_id": 0, "id": 1, "title": 1, "image_url": 1, "totalTime": 1}
            ).to_list(length=10)
        
        # Create voting session
        session_doc = {
            "id": session_id,
            "family_id": family_id,
            "created_by": current_user.id,
            "meal_type": request.meal_type,
            "meal_date": request.meal_date,
            "recipe_options": recipes if recipes else [{"id": rid, "title": f"Recipe {rid[:8]}"} for rid in request.recipe_ids],
            "votes": {},  # {user_id: recipe_id}
            "status": "active",
            "expires_at": expires_at.isoformat(),
            "created_at": now.isoformat()
        }
        
        await db.voting_sessions.insert_one(session_doc)
        
        # ========== PHASE 1: PUSH/SMS NOTIFICATIONS ==========
        # Get family members for notifications
        members = family.get("members", [])
        member_ids = [m["user_id"] for m in members]
        
        members_data = await db.users.find({
            "id": {"$in": member_ids}
        }, {"_id": 0, "id": 1, "fcm_token": 1, "phone_number": 1, "push_notifications": 1}).to_list(length=100)
        
        # Format for notification service
        members_for_notify = [
            {
                "user_id": m.get("id"),
                "fcm_token": m.get("fcm_token"),
                "phone_number": m.get("phone_number")
            }
            for m in members_data
            if m.get("push_notifications", {}).get("voting_notifications", True) is not False
        ]
        
        notify_result = await notification_service.on_voting_started(
            members_for_notify,
            session_doc,
            family["name"],
            current_user.id
        )
        notifications_sent = notify_result.get("sent", 0)
        logger.info(f"Voting notifications sent: {notifications_sent}")
        # =====================================================
        
        session_doc.pop("_id", None)
        
        return {
            "success": True,
            "message": "Voting session created",
            "session": {
                "id": session_id,
                "meal_type": request.meal_type,
                "meal_date": request.meal_date,
                "recipe_options": session_doc["recipe_options"],
                "expires_at": expires_at.isoformat()
            },
            "notifications_sent": notifications_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create voting session error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create voting session")


@router.get("/voting/active")
async def get_active_voting_sessions(current_user: User = Depends(get_current_user)):
    """Get active voting sessions for the user's family"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            return {
                "success": True,
                "sessions": []
            }
        
        family_id = user["family_account"]["family_id"]
        now = datetime.now(timezone.utc)
        
        sessions = await db.voting_sessions.find({
            "family_id": family_id,
            "status": "active",
            "expires_at": {"$gt": now.isoformat()}
        }, {"_id": 0}).sort("created_at", -1).to_list(length=10)
        
        # Add user's vote status to each session
        for session in sessions:
            session["user_voted"] = current_user.id in session.get("votes", {})
            session["vote_count"] = len(session.get("votes", {}))
        
        return {
            "success": True,
            "sessions": sessions
        }
        
    except Exception as e:
        logger.error(f"Get voting sessions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get voting sessions")


@router.post("/voting/{session_id}/vote")
async def cast_vote(
    session_id: str,
    request: CastVoteRequest,
    current_user: User = Depends(get_current_user)
):
    """Cast a vote in a voting session"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You need a family account to vote")
        
        session = await db.voting_sessions.find_one({"id": session_id}, {"_id": 0})
        
        if not session:
            raise HTTPException(status_code=404, detail="Voting session not found")
        
        if session["family_id"] != user["family_account"]["family_id"]:
            raise HTTPException(status_code=403, detail="You're not part of this family")
        
        if session["status"] != "active":
            raise HTTPException(status_code=400, detail="Voting session is no longer active")
        
        now = datetime.now(timezone.utc)
        if session["expires_at"] < now.isoformat():
            raise HTTPException(status_code=400, detail="Voting session has expired")
        
        # Validate recipe_id is in options
        recipe_ids = [r["id"] for r in session.get("recipe_options", [])]
        if request.recipe_id not in recipe_ids:
            raise HTTPException(status_code=400, detail="Invalid recipe option")
        
        # Record vote
        await db.voting_sessions.update_one(
            {"id": session_id},
            {"$set": {f"votes.{current_user.id}": request.recipe_id}}
        )
        
        return {
            "success": True,
            "message": "Vote recorded",
            "voted_for": request.recipe_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cast vote error: {e}")
        raise HTTPException(status_code=500, detail="Failed to cast vote")


@router.post("/voting/{session_id}/complete")
async def complete_voting_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Complete voting session + Announce winner via WhatsApp"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You need a family account")
        
        session = await db.voting_sessions.find_one({"id": session_id}, {"_id": 0})
        
        if not session:
            raise HTTPException(status_code=404, detail="Voting session not found")
        
        if session["family_id"] != user["family_account"]["family_id"]:
            raise HTTPException(status_code=403, detail="You're not part of this family")
        
        # Only owner or session creator can complete
        family = await db.families.find_one({"id": session["family_id"]}, {"_id": 0})
        is_owner = family and family.get("owner_id") == current_user.id
        is_creator = session.get("created_by") == current_user.id
        
        if not (is_owner or is_creator):
            raise HTTPException(status_code=403, detail="Only family owner or session creator can complete voting")
        
        # Calculate results
        votes = session.get("votes", {})
        if not votes:
            raise HTTPException(status_code=400, detail="No votes have been cast yet")
        
        vote_counts = {}
        for recipe_id in votes.values():
            vote_counts[recipe_id] = vote_counts.get(recipe_id, 0) + 1
        
        winner_id = max(vote_counts, key=vote_counts.get)
        winner_votes = vote_counts[winner_id]
        
        # Get winner recipe details
        winner_recipe = next(
            (r for r in session.get("recipe_options", []) if r["id"] == winner_id),
            {"id": winner_id, "title": "Selected Recipe"}
        )
        
        now = datetime.now(timezone.utc)
        
        # Update session
        await db.voting_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "status": "completed",
                    "winner_recipe_id": winner_id,
                    "winner_vote_count": winner_votes,
                    "vote_results": vote_counts,
                    "completed_at": now.isoformat()
                }
            }
        )
        
        # ========== PHASE 1: PUSH/SMS NOTIFICATIONS ==========
        announcements_sent = 0
        
        if family:
            # Get family members for notifications
            members = family.get("members", [])
            member_ids = [m["user_id"] for m in members]
            
            members_data = await db.users.find({
                "id": {"$in": member_ids}
            }, {"_id": 0, "id": 1, "fcm_token": 1, "phone_number": 1, "push_notifications": 1}).to_list(length=100)
            
            # Format for notification service
            members_for_notify = [
                {
                    "user_id": m.get("id"),
                    "fcm_token": m.get("fcm_token"),
                    "phone_number": m.get("phone_number")
                }
                for m in members_data
                if m.get("push_notifications", {}).get("winner_announcements", True) is not False
            ]
            
            notify_result = await notification_service.on_winner_announced(
                members_for_notify,
                winner_recipe,
                winner_votes,
                family["name"]
            )
            announcements_sent = notify_result.get("sent", 0)
            logger.info(f"Winner announcements sent: {announcements_sent}")
        # =====================================================
        
        return {
            "success": True,
            "message": "Voting completed",
            "winner": {
                "recipe_id": winner_id,
                "recipe": winner_recipe,
                "votes": winner_votes
            },
            "all_results": vote_counts,
            "announcements_sent": announcements_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complete voting error: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete voting")


@router.get("/voting/{session_id}/results")
async def get_voting_results(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get voting session results"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
        
        if not user or not user.get("family_account", {}).get("family_id"):
            raise HTTPException(status_code=400, detail="You need a family account")
        
        session = await db.voting_sessions.find_one({"id": session_id}, {"_id": 0})
        
        if not session:
            raise HTTPException(status_code=404, detail="Voting session not found")
        
        if session["family_id"] != user["family_account"]["family_id"]:
            raise HTTPException(status_code=403, detail="You're not part of this family")
        
        # Calculate current vote counts
        votes = session.get("votes", {})
        vote_counts = {}
        for recipe_id in votes.values():
            vote_counts[recipe_id] = vote_counts.get(recipe_id, 0) + 1
        
        # Enrich recipe options with vote counts
        results = []
        for recipe in session.get("recipe_options", []):
            results.append({
                **recipe,
                "votes": vote_counts.get(recipe["id"], 0)
            })
        
        # Sort by votes
        results.sort(key=lambda x: x["votes"], reverse=True)
        
        return {
            "success": True,
            "session": {
                "id": session["id"],
                "meal_type": session["meal_type"],
                "meal_date": session["meal_date"],
                "status": session["status"],
                "total_votes": len(votes)
            },
            "results": results,
            "winner": session.get("winner_recipe_id"),
            "user_voted": current_user.id in votes,
            "user_vote": votes.get(current_user.id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get voting results error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get voting results")


# ============== WHATSAPP SETTINGS ROUTES ==============

@router.put("/whatsapp/settings")
async def update_whatsapp_settings(
    request: UpdateWhatsAppSettingsRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user's WhatsApp notification settings"""
    try:
        settings = {
            "enabled": request.enabled,
            "voting_reminders": request.voting_reminders,
            "winner_announcements": request.winner_announcements,
            "family_invites": request.family_invites
        }
        
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"whatsapp_notifications": settings}}
        )
        
        return {
            "success": True,
            "message": "WhatsApp settings updated",
            "settings": settings
        }
        
    except Exception as e:
        logger.error(f"Update WhatsApp settings error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


@router.get("/whatsapp/settings")
async def get_whatsapp_settings(current_user: User = Depends(get_current_user)):
    """Get user's WhatsApp notification settings"""
    try:
        user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "whatsapp_notifications": 1, "phone_number": 1})
        
        default_settings = {
            "enabled": True,
            "voting_reminders": True,
            "winner_announcements": True,
            "family_invites": True
        }
        
        return {
            "success": True,
            "settings": user.get("whatsapp_notifications", default_settings),
            "phone_number": user.get("phone_number"),
            "has_phone": bool(user.get("phone_number"))
        }
        
    except Exception as e:
        logger.error(f"Get WhatsApp settings error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get settings")
