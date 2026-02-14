"""
Tests for the subscription audit log feature.
"""
import pytest
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.entitlement_guard import log_plan_change, get_plan_change_history

# MongoDB connection details
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'moodfood')


async def get_db():
    """Get database connection."""
    client = AsyncIOMotorClient(MONGO_URL)
    return client.get_database(DB_NAME), client


async def cleanup_test_user(db, user_id):
    """Clean up test data for a user."""
    await db.audit_logs.delete_many({"user_id": user_id})


class TestAuditLog:
    """Tests for audit log functionality."""
    
    def test_basic_audit_log_creation(self):
        """Test creating a basic audit log entry."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_basic"
            
            try:
                result = await log_plan_change(
                    db=db,
                    user_id=user_id,
                    old_plan="free",
                    new_plan="premium_monthly",
                    reason="payment_verified"
                )
                
                assert result is not None
                assert result["user_id"] == user_id
                assert result["old_plan"] == "free"
                assert result["new_plan"] == "premium_monthly"
                assert result["reason"] == "payment_verified"
                assert "timestamp" in result
                assert "id" in result
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_audit_log_with_metadata(self):
        """Test audit log with metadata."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_metadata"
            
            try:
                result = await log_plan_change(
                    db=db,
                    user_id=user_id,
                    old_plan="premium_monthly",
                    new_plan="chef_pro_annual",
                    reason="upgrade",
                    metadata={
                        "subscription_id": "sub_123",
                        "payment_id": "pay_456",
                        "amount": 179.99,
                        "currency": "USD"
                    }
                )
                
                assert result["metadata"]["subscription_id"] == "sub_123"
                assert result["metadata"]["payment_id"] == "pay_456"
                assert result["metadata"]["amount"] == 179.99
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_audit_log_cancellation(self):
        """Test audit log for cancellation."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_cancel"
            
            try:
                result = await log_plan_change(
                    db=db,
                    user_id=user_id,
                    old_plan="premium_annual",
                    new_plan="free",
                    reason="user_canceled_immediately",
                    metadata={"subscription_id": "sub_canceled"}
                )
                
                assert result["old_plan"] == "premium_annual"
                assert result["new_plan"] == "free"
                assert result["reason"] == "user_canceled_immediately"
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_audit_log_handles_none_plans(self):
        """Test audit log handles None plans gracefully."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_none"
            
            try:
                result = await log_plan_change(
                    db=db,
                    user_id=user_id,
                    old_plan=None,
                    new_plan="free",
                    reason="new_signup"
                )
                
                assert result["old_plan"] == "none"  # Converted to "none" string
                assert result["new_plan"] == "free"
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_get_user_history(self):
        """Test retrieving user's plan change history."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_history"
            
            try:
                # Create multiple entries
                await log_plan_change(db, user_id, "free", "premium_monthly", "payment_1")
                await log_plan_change(db, user_id, "premium_monthly", "chef_pro_annual", "upgrade")
                await log_plan_change(db, user_id, "chef_pro_annual", "free", "canceled")
                
                history = await get_plan_change_history(db, user_id, limit=10)
                
                assert len(history) == 3
                # Should be newest first
                assert history[0]["reason"] == "canceled"
                assert history[1]["reason"] == "upgrade"
                assert history[2]["reason"] == "payment_1"
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_history_limit(self):
        """Test that limit parameter works."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_limit"
            
            try:
                # Create 5 entries
                for i in range(5):
                    await log_plan_change(db, user_id, "free", "premium", f"change_{i}")
                
                history = await get_plan_change_history(db, user_id, limit=3)
                
                assert len(history) == 3
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_empty_history(self):
        """Test that empty history returns empty list."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_nonexistent"
            
            try:
                history = await get_plan_change_history(db, user_id, limit=10)
                assert history == []
            finally:
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())
    
    def test_full_subscription_lifecycle(self):
        """Test audit trail through full subscription lifecycle."""
        async def run():
            db, client = await get_db()
            user_id = "test_user_lifecycle"
            
            try:
                # 1. User signs up (free)
                await log_plan_change(db, user_id, None, "free", "new_signup")
                
                # 2. User upgrades to premium
                await log_plan_change(
                    db, user_id, "free", "premium_monthly", "payment_verified",
                    metadata={"payment_id": "pay_001"}
                )
                
                # 3. User upgrades to annual
                await log_plan_change(
                    db, user_id, "premium_monthly", "premium_annual", "upgrade",
                    metadata={"payment_id": "pay_002", "savings": "33%"}
                )
                
                # 4. User schedules cancellation
                await log_plan_change(
                    db, user_id, "premium_annual", "premium_annual", "user_scheduled_cancellation",
                    metadata={"cancel_at_period_end": True}
                )
                
                # 5. Period ends, user downgraded
                await log_plan_change(db, user_id, "premium_annual", "free", "period_ended")
                
                history = await get_plan_change_history(db, user_id)
                
                assert len(history) == 5
                
                # Verify order (newest first)
                assert history[0]["reason"] == "period_ended"
                assert history[1]["reason"] == "user_scheduled_cancellation"
                assert history[2]["reason"] == "upgrade"
                assert history[3]["reason"] == "payment_verified"
                assert history[4]["reason"] == "new_signup"
            finally:
                await cleanup_test_user(db, user_id)
                client.close()
        
        asyncio.get_event_loop().run_until_complete(run())


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
