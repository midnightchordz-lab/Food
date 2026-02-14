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


@pytest.fixture
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db():
    """Create database connection for tests."""
    mongo_url = os.environ.get('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database(os.environ.get('DB_NAME', 'moodfood'))
    yield db
    client.close()


@pytest.fixture
async def cleanup_test_data(db):
    """Clean up test audit log entries after tests."""
    yield
    # Clean up any test data
    await db.audit_logs.delete_many({"user_id": {"$regex": "^test_"}})


class TestAuditLogCreation:
    """Tests for log_plan_change function."""
    
    @pytest.mark.asyncio
    async def test_basic_audit_log_creation(self, db, cleanup_test_data):
        """Test creating a basic audit log entry."""
        user_id = "test_user_basic"
        
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
    
    @pytest.mark.asyncio
    async def test_audit_log_with_metadata(self, db, cleanup_test_data):
        """Test audit log with metadata."""
        user_id = "test_user_metadata"
        
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
    
    @pytest.mark.asyncio
    async def test_audit_log_cancellation(self, db, cleanup_test_data):
        """Test audit log for cancellation."""
        user_id = "test_user_cancel"
        
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
    
    @pytest.mark.asyncio
    async def test_audit_log_handles_none_plans(self, db, cleanup_test_data):
        """Test audit log handles None plans gracefully."""
        user_id = "test_user_none"
        
        result = await log_plan_change(
            db=db,
            user_id=user_id,
            old_plan=None,
            new_plan="free",
            reason="new_signup"
        )
        
        assert result["old_plan"] == "none"  # Converted to "none" string
        assert result["new_plan"] == "free"


class TestAuditLogRetrieval:
    """Tests for get_plan_change_history function."""
    
    @pytest.mark.asyncio
    async def test_get_user_history(self, db, cleanup_test_data):
        """Test retrieving user's plan change history."""
        user_id = "test_user_history"
        
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
    
    @pytest.mark.asyncio
    async def test_history_limit(self, db, cleanup_test_data):
        """Test that limit parameter works."""
        user_id = "test_user_limit"
        
        # Create 5 entries
        for i in range(5):
            await log_plan_change(db, user_id, "free", "premium", f"change_{i}")
        
        history = await get_plan_change_history(db, user_id, limit=3)
        
        assert len(history) == 3
    
    @pytest.mark.asyncio
    async def test_empty_history(self, db, cleanup_test_data):
        """Test that empty history returns empty list."""
        user_id = "test_user_nonexistent"
        
        history = await get_plan_change_history(db, user_id, limit=10)
        
        assert history == []


class TestAuditLogScenarios:
    """Tests for real-world audit log scenarios."""
    
    @pytest.mark.asyncio
    async def test_full_subscription_lifecycle(self, db, cleanup_test_data):
        """Test audit trail through full subscription lifecycle."""
        user_id = "test_user_lifecycle"
        
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
    
    @pytest.mark.asyncio
    async def test_admin_correction_scenario(self, db, cleanup_test_data):
        """Test audit log for admin corrections."""
        user_id = "test_user_admin"
        
        # Simulate false downgrade correction
        await log_plan_change(
            db, user_id, "free", "premium_annual", "admin_bulk_restoration",
            metadata={
                "subscription_id": "sub_restored",
                "payment_id": "pay_original",
                "previous_status": "invalid_blocked"
            }
        )
        
        history = await get_plan_change_history(db, user_id)
        
        assert len(history) == 1
        assert history[0]["reason"] == "admin_bulk_restoration"
        assert history[0]["metadata"]["previous_status"] == "invalid_blocked"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
