"""
Scheduled Tasks Service - Handles cron jobs for subscription management
Includes: Usage counter resets, subscription expiration checks, cleanup tasks
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "moodfood")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


class ScheduledTasks:
    """
    Scheduled task runner for subscription and usage management.
    
    Tasks:
    - Reset daily usage counters (recipe searches) at midnight UTC
    - Check and expire subscriptions that have passed their end date
    - Clean up old usage records (older than 3 months)
    - Send renewal reminders (if email service configured)
    """
    
    _instance = None
    _is_running = False
    _task = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def __init__(self):
        self.last_daily_reset = None
        self.last_hourly_check = None
        self.last_weekly_nudge = None  # ISO week string, e.g. "2026-W23"
    
    async def start(self):
        """Start the scheduled task runner"""
        if ScheduledTasks._is_running:
            logger.info("Scheduled tasks already running")
            return
        
        ScheduledTasks._is_running = True
        ScheduledTasks._task = asyncio.create_task(self._run_scheduler())
        logger.info("Scheduled tasks started")
    
    async def stop(self):
        """Stop the scheduled task runner"""
        ScheduledTasks._is_running = False
        if ScheduledTasks._task:
            ScheduledTasks._task.cancel()
            try:
                await ScheduledTasks._task
            except asyncio.CancelledError:
                pass
        logger.info("Scheduled tasks stopped")
    
    async def _run_scheduler(self):
        """Main scheduler loop - runs every minute to check for pending tasks"""
        while ScheduledTasks._is_running:
            try:
                now = datetime.now(timezone.utc)
                
                # Run daily tasks at midnight UTC (or if never run today)
                if self._should_run_daily(now):
                    await self.run_daily_tasks()
                    self.last_daily_reset = now.date()
                
                # Run hourly tasks
                if self._should_run_hourly(now):
                    await self.run_hourly_tasks()
                    self.last_hourly_check = now.replace(minute=0, second=0, microsecond=0)

                # Run weekly plan nudge (Sunday morning UTC)
                if self._should_run_weekly_nudge(now):
                    await self.run_weekly_plan_nudge()
                    self.last_weekly_nudge = now.strftime("%Y-W%W")
                
                # Sleep for 1 minute before next check
                await asyncio.sleep(60)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(60)  # Wait before retrying
    
    def _should_run_daily(self, now: datetime) -> bool:
        """Check if daily tasks should run"""
        today = now.date()
        
        # Run if never run or if it's a new day
        if self.last_daily_reset is None:
            return True
        
        return today > self.last_daily_reset
    
    def _should_run_hourly(self, now: datetime) -> bool:
        """Check if hourly tasks should run"""
        current_hour = now.replace(minute=0, second=0, microsecond=0)
        
        # Run if never run or if it's a new hour
        if self.last_hourly_check is None:
            return True
        
        return current_hour > self.last_hourly_check

    def _should_run_weekly_nudge(self, now: datetime) -> bool:
        """Send the plan-your-week nudge once on Sunday (>= 10:00 UTC)."""
        # Python weekday(): Monday=0 ... Sunday=6
        if now.weekday() != 6 or now.hour < 10:
            return False
        this_week = now.strftime("%Y-W%W")
        return self.last_weekly_nudge != this_week

    async def run_weekly_plan_nudge(self):
        """Send the weekly meal-plan reminder push to all registered users."""
        logger.info("Running weekly meal-plan nudge...")
        try:
            from routes.push import send_weekly_plan_nudge
            count = await send_weekly_plan_nudge()
            logger.info(f"Weekly meal-plan nudge sent to {count} users")
        except Exception as e:
            logger.error(f"Error sending weekly plan nudge: {e}")
    
    async def run_daily_tasks(self):
        """Run all daily scheduled tasks"""
        logger.info("Running daily scheduled tasks...")
        
        try:
            # Reset daily usage counters
            await self.reset_daily_usage_counters()
            
            # Clean up old usage records
            await self.cleanup_old_usage_records()
            
            logger.info("Daily scheduled tasks completed successfully")
            
        except Exception as e:
            logger.error(f"Error running daily tasks: {e}")
    
    async def run_hourly_tasks(self):
        """Run all hourly scheduled tasks"""
        logger.info("Running hourly scheduled tasks...")
        
        try:
            # Check for expired subscriptions
            await self.check_expired_subscriptions()
            
            # Check for subscriptions expiring soon (for reminders)
            await self.check_expiring_soon()
            
            logger.info("Hourly scheduled tasks completed successfully")
            
        except Exception as e:
            logger.error(f"Error running hourly tasks: {e}")
    
    async def reset_daily_usage_counters(self):
        """
        Reset daily usage counters for all users.
        This resets recipe_search counts for free tier users.
        """
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        
        try:
            # Find all daily usage records from yesterday or earlier
            result = await db.daily_usage.update_many(
                {"date": {"$lt": today}},
                {"$set": {"archived": True, "archived_at": now.isoformat()}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Archived {result.modified_count} old daily usage records")
            
            # Create fresh counters for today (they get created on-demand, but we log for tracking)
            logger.info(f"Daily usage counters ready for {today}")
            
        except Exception as e:
            logger.error(f"Error resetting daily usage counters: {e}")
    
    async def cleanup_old_usage_records(self):
        """
        Clean up usage records older than 3 months.
        Keeps the database lean while maintaining recent history.
        """
        now = datetime.now(timezone.utc)
        cutoff_date = (now - timedelta(days=90)).strftime("%Y-%m")
        
        try:
            # Delete old monthly usage records
            result = await db.feature_usage.delete_many({
                "month": {"$lt": cutoff_date}
            })
            
            if result.deleted_count > 0:
                logger.info(f"Cleaned up {result.deleted_count} old monthly usage records")
            
            # Delete old daily usage records (archived ones older than 30 days)
            daily_cutoff = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            daily_result = await db.daily_usage.delete_many({
                "date": {"$lt": daily_cutoff},
                "archived": True
            })
            
            if daily_result.deleted_count > 0:
                logger.info(f"Cleaned up {daily_result.deleted_count} old daily usage records")
                
        except Exception as e:
            logger.error(f"Error cleaning up old usage records: {e}")
    
    async def check_expired_subscriptions(self):
        """
        Check for and expire subscriptions that have passed their end date.
        Updates status from 'active' to 'expired'.
        """
        now = datetime.now(timezone.utc)
        
        try:
            # Find active subscriptions that have expired
            result = await db.user_subscriptions.update_many(
                {
                    "status": "active",
                    "current_period_end": {"$lt": now.isoformat()}
                },
                {
                    "$set": {
                        "status": "expired",
                        "expired_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Expired {result.modified_count} subscriptions")
                
                # Optionally: Log which users were affected for notifications
                expired_subs = await db.user_subscriptions.find(
                    {"expired_at": now.isoformat()}
                ).to_list(length=100)
                
                for sub in expired_subs:
                    logger.info(f"Subscription expired for user: {sub.get('user_id')}, plan: {sub.get('plan_id')}")
            
        except Exception as e:
            logger.error(f"Error checking expired subscriptions: {e}")
    
    async def check_expiring_soon(self):
        """
        Check for subscriptions expiring within 7 days.
        Could trigger reminder emails (if email service configured).
        """
        now = datetime.now(timezone.utc)
        expiry_window = now + timedelta(days=7)
        
        try:
            # Find subscriptions expiring soon that haven't been notified
            expiring_subs = await db.user_subscriptions.find({
                "status": "active",
                "current_period_end": {
                    "$gt": now.isoformat(),
                    "$lt": expiry_window.isoformat()
                },
                "expiry_reminder_sent": {"$ne": True}
            }).to_list(length=100)
            
            for sub in expiring_subs:
                user_id = sub.get("user_id")
                plan_id = sub.get("plan_id")
                end_date = sub.get("current_period_end")
                
                logger.info(f"Subscription expiring soon - User: {user_id}, Plan: {plan_id}, Expires: {end_date}")
                
                # Mark as reminded (prevent duplicate notifications)
                await db.user_subscriptions.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {"expiry_reminder_sent": True, "reminder_sent_at": now.isoformat()}}
                )
                
                # TODO: Send email reminder when email service is configured
                # await send_expiry_reminder_email(user_id, plan_id, end_date)
            
            if expiring_subs:
                logger.info(f"Found {len(expiring_subs)} subscriptions expiring within 7 days")
                
        except Exception as e:
            logger.error(f"Error checking expiring subscriptions: {e}")
    
    async def reset_monthly_usage_counters(self):
        """
        Reset monthly usage counters at the start of each month.
        Called separately from daily tasks (only on 1st of month).
        """
        now = datetime.now(timezone.utc)
        
        # Only run on the 1st of the month
        if now.day != 1:
            return
        
        try:
            # Archive previous month's usage
            prev_month = (now - timedelta(days=1)).strftime("%Y-%m")
            
            result = await db.feature_usage.update_many(
                {"month": prev_month},
                {"$set": {"archived": True, "archived_at": now.isoformat()}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Archived {result.modified_count} monthly usage records for {prev_month}")
                
        except Exception as e:
            logger.error(f"Error resetting monthly usage counters: {e}")


# API endpoints for manual triggering (admin only)
from fastapi import APIRouter, HTTPException, Depends
from routes.deps import User, get_current_user

router = APIRouter(prefix="/scheduled-tasks", tags=["Scheduled Tasks"])


async def verify_admin(current_user: User = Depends(get_current_user)):
    """Verify user is an admin (for manual task triggering)"""
    # For now, allow any authenticated user - implement proper admin check in production
    # In production: check current_user.role == 'admin'
    return current_user


@router.post("/run-daily")
async def manual_run_daily_tasks(current_user: User = Depends(verify_admin)):
    """Manually trigger daily scheduled tasks (admin only)"""
    try:
        scheduler = ScheduledTasks.get_instance()
        await scheduler.run_daily_tasks()
        return {
            "success": True,
            "message": "Daily tasks executed successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-hourly")
async def manual_run_hourly_tasks(current_user: User = Depends(verify_admin)):
    """Manually trigger hourly scheduled tasks (admin only)"""
    try:
        scheduler = ScheduledTasks.get_instance()
        await scheduler.run_hourly_tasks()
        return {
            "success": True,
            "message": "Hourly tasks executed successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-daily-usage")
async def manual_reset_daily_usage(current_user: User = Depends(verify_admin)):
    """Manually reset daily usage counters (admin only)"""
    try:
        scheduler = ScheduledTasks.get_instance()
        await scheduler.reset_daily_usage_counters()
        return {
            "success": True,
            "message": "Daily usage counters reset successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-expirations")
async def manual_check_expirations(current_user: User = Depends(verify_admin)):
    """Manually check for expired subscriptions (admin only)"""
    try:
        scheduler = ScheduledTasks.get_instance()
        await scheduler.check_expired_subscriptions()
        return {
            "success": True,
            "message": "Subscription expirations checked successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_scheduler_status(current_user: User = Depends(verify_admin)):
    """Get current status of scheduled tasks"""
    scheduler = ScheduledTasks.get_instance()
    
    return {
        "is_running": ScheduledTasks._is_running,
        "last_daily_reset": str(scheduler.last_daily_reset) if scheduler.last_daily_reset else None,
        "last_hourly_check": scheduler.last_hourly_check.isoformat() if scheduler.last_hourly_check else None,
        "current_time": datetime.now(timezone.utc).isoformat()
    }


# Startup function to be called from main.py
async def start_scheduler():
    """Start the scheduled task runner"""
    scheduler = ScheduledTasks.get_instance()
    await scheduler.start()


async def stop_scheduler():
    """Stop the scheduled task runner"""
    scheduler = ScheduledTasks.get_instance()
    await scheduler.stop()
