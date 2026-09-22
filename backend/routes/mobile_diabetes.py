"""
Mobile Diabetes Planner - unguarded diabetes-friendly weekly meal plan for the mobile app.

Premium gating is handled client-side via RevenueCat. Generates a 7-day plan where
every meal carries an estimated net-carb count and a blood-sugar flag
(safe / caution / spike) computed against the diabetes type's per-meal carb ceiling.
"""
import os
import json
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from emergentintegrations.llm.chat import LlmChat, UserMessage

from .deps import db, User, get_current_user
from .exclusions import get_user_excluded_ingredients
from .diabetes import DIABETES_GUIDELINES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mobile-diabetes", tags=["Mobile Diabetes"])

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"]


class DiabetesPlanRequest(BaseModel):
    diabetes_type: str = "type2"
    dietary_preference: str = "balanced"


def _flag_for(net_carbs: int, max_carbs: int) -> str:
    """Blood-sugar impact flag relative to the per-meal carb ceiling."""
    if net_carbs <= max_carbs * 0.7:
        return "safe"
    if net_carbs <= max_carbs:
        return "caution"
    return "spike"


def _extract_json(text: str):
    # Try to locate the first {...} block.
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


async def _generate_plan(diabetes_type: str, dietary: str, exclusions: list[str]) -> dict:
    guide = DIABETES_GUIDELINES.get(diabetes_type, DIABETES_GUIDELINES["type2"])
    max_carbs = guide["max_carbs_per_meal"]

    exclusion_line = ""
    if exclusions:
        exclusion_line = f"\nNEVER include these ingredients (allergies/exclusions): {', '.join(exclusions)}."

    system_msg = (
        f"You are a certified diabetes dietitian creating a 7-day meal plan for {guide['name']}. "
        f"Every meal must keep net carbs at or below {max_carbs}g and favour a low glycemic index (<{guide['max_glycemic_index']}). "
        f"Dietary preference: {dietary}.{exclusion_line}\n"
        "Return ONLY valid JSON (no markdown, no commentary) in EXACTLY this shape:\n"
        '{"days":[{"day":"Monday","meals":[{"type":"Breakfast","name":"Dish name","net_carbs":30,"note":"one short reason it is blood-sugar friendly"}]}]}\n'
        "Provide all 7 days (Monday..Sunday), each with 3 meals (Breakfast, Lunch, Dinner). "
        "net_carbs is an integer grams estimate. Keep dish names real and appetising. Keep notes under 12 words."
    )

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"mobile-diabetes-{uuid.uuid4().hex[:8]}",
        system_message=system_msg,
    )
    chat.with_model("openai", "gpt-4o-mini")
    raw = await chat.send_message(UserMessage(text="Generate the full 7-day diabetes-friendly plan as JSON."))

    parsed = _extract_json(raw)
    if not parsed or "days" not in parsed:
        raise HTTPException(status_code=502, detail="Could not generate a valid plan, please try again")

    # Normalise + attach flags computed server-side for consistency.
    days_out = []
    total_carbs = 0
    meal_count = 0
    for day in DAYS:
        src = next((d for d in parsed["days"] if str(d.get("day", "")).lower() == day.lower()), None)
        meals = []
        src_meals = (src or {}).get("meals", []) if src else []
        for mt in MEAL_TYPES:
            m = next((x for x in src_meals if str(x.get("type", "")).lower() == mt.lower()), None)
            if not m:
                continue
            try:
                nc = int(round(float(m.get("net_carbs", max_carbs))))
            except Exception:
                nc = max_carbs
            nc = max(0, min(nc, 200))
            total_carbs += nc
            meal_count += 1
            meals.append({
                "type": mt,
                "name": str(m.get("name", "Balanced meal")).strip(),
                "net_carbs": nc,
                "gi": guide["max_glycemic_index"],
                "flag": _flag_for(nc, max_carbs),
                "note": str(m.get("note", "")).strip(),
            })
        if meals:
            days_out.append({"day": day, "meals": meals})

    if not days_out:
        raise HTTPException(status_code=502, detail="Could not generate a valid plan, please try again")

    avg_per_day = round(total_carbs / 7) if meal_count else 0
    return {
        "diabetes_type": diabetes_type,
        "diabetes_label": guide["name"],
        "dietary_preference": dietary,
        "max_carbs_per_meal": max_carbs,
        "days": days_out,
        "avg_carbs_per_day": avg_per_day,
    }


@router.post("/plan")
async def generate_diabetes_plan(req: DiabetesPlanRequest, current_user: User = Depends(get_current_user)):
    exclusions = await get_user_excluded_ingredients(current_user.id)
    plan = await _generate_plan(req.diabetes_type, req.dietary_preference, exclusions)

    today = datetime.now(timezone.utc)
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    doc = {
        "user_id": current_user.id,
        "week_start": week_start,
        "plan": plan,
        "created_at": today.isoformat(),
    }
    await db.mobile_diabetes_plans.update_one(
        {"user_id": current_user.id},
        {"$set": doc},
        upsert=True,
    )
    return {"has_plan": True, "week_start": week_start, "plan": plan}


@router.get("/plan")
async def get_diabetes_plan(current_user: User = Depends(get_current_user)):
    doc = await db.mobile_diabetes_plans.find_one({"user_id": current_user.id}, {"_id": 0})
    if not doc:
        return {"has_plan": False, "plan": None}
    return {"has_plan": True, "week_start": doc.get("week_start"), "plan": doc.get("plan")}
