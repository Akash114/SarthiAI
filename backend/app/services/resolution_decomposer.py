"""LLM-backed resolution decomposition service."""
from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import openai
from pydantic import BaseModel, Field

from app.core.config import settings
from app.observability.metrics import log_metric
from app.observability.tracing import trace
from app.services.effort_band import EFFORT_BAND_BUDGETS
from app.services.plan_evaluator import EvaluationResult, evaluate_plan


class TaskDraft(BaseModel):
    """Represents a single week-one task suggestion."""

    title: str
    intent: str = Field(..., description="Brief reason or insight driving the task.")
    estimated_duration_min: int = Field(..., ge=5, description="Estimated minutes needed.")
    cadence: Any = Field(..., description="Cadence descriptor (string or structured dict).")
    suggested_day: Optional[str] = Field(default=None, description="ISO day suggestion.")
    suggested_time: Optional[str] = Field(default=None, description="Time hint like 07:30.")
    confidence: Optional[str] = Field(
        default="medium",
        description="Confidence level (high/medium/low) in the scheduling suggestion.",
    )
    scheduled_day: Optional[str] = Field(
        default=None,
        description="Deprecated; preserved for backward compatibility.",
    )
    scheduled_time: Optional[str] = Field(
        default=None,
        description="Deprecated; preserved for backward compatibility.",
    )
    note: Optional[str] = Field(default=None, description="Extra setup info or tips.")


class WeeklyMilestone(BaseModel):
    """High-level milestone for a given week."""

    week_number: int = Field(..., ge=1, le=12)
    focus_summary: str = Field(..., description="Key focus for the week.")


class PlanWeekSection(BaseModel):
    week: int
    focus: str
    tasks: List[TaskDraft] = Field(default_factory=list)


class ResolutionPlan(BaseModel):
    """Overall structured plan returned by the LLM."""

    resolution_title: str
    why_this_matters: str
    duration_weeks: int = Field(..., ge=1, le=12)
    milestones: List[WeeklyMilestone] = Field(..., min_length=1, max_length=12)
    week_1_tasks: List[TaskDraft] = Field(..., min_length=1)
    weeks: List[PlanWeekSection] = Field(default_factory=list)
    band: str = "medium"
    band_rationale: str = "Default effort band"
    evaluation_summary: Dict[str, Any] = Field(default_factory=dict)


ACTIVITY_KEYWORDS = {
    "run": "running",
    "running": "running",
    "jog": "running",
    "walk": "walking",
    "walking": "walking",
    "yoga": "yoga practice",
    "meditate": "meditation",
    "meditation": "meditation",
    "guitar": "guitar practice",
    "piano": "piano practice",
    "music": "music practice",
    "strength": "strength training",
    "lift": "strength training",
    "code": "coding",
    "write": "writing",
}

SPECIALTY_CONFIG: Dict[str, Dict[str, Any]] = {
    "music_skill": {
        "types": {"skill", "learning"},
        "keywords": {"music", "guitar", "piano", "violin", "cello", "drum", "vocal", "sing", "song"},
        "prompt_hint": (
            "### DOMAIN FOCUS: MUSIC PRACTICE\n"
            "- Name specific drills such as scales, chord progressions, or ear-training reps.\n"
            "- Include at least one recording or reflection micro-task so the user can review tone and timing."
        ),
        "tasks": [
            {
                "title": "Stage instrument and tuner",
                "intent": "Make practice frictionless by prepping the instrument corner and tuner.",
                "note": "Lay out instrument, tuner, metronome app, and current sheet music.",
                "duration": 10,
                "cadence": "flex",
            },
            {
                "title": "Chromatic scale warm-up (C to C)",
                "intent": "Rebuild finger agility and tone before diving into repertoire.",
                "note": "Metronome 70 BPM, 3 passes legato + 3 passes staccato while focusing on even tone.",
                "duration": 20,
                "cadence": {"type": "specific_days", "days": ["monday", "wednesday", "friday"], "times": ["evening"]},
            },
            {
                "title": "Chord progression loop (I-IV-V)",
                "intent": "Lock in smooth transitions at a sustainable tempo.",
                "note": "Loop the progression for 15 minutes, record a take, jot one insight about tension/release.",
                "duration": 25,
                "cadence": {"type": "x_per_week", "count": 3, "times": ["evening"]},
            },
        ],
    },
    "fitness": {
        "types": {"health", "fitness", "habit"},
        "keywords": {"run", "running", "cardio", "workout", "gym", "yoga", "strength", "training"},
        "prompt_hint": (
            "### DOMAIN FOCUS: FITNESS\n"
            "- Schedule two anchor workouts that last close to the target duration (e.g., 30-minute run/walk intervals) and spread recovery/activation days between them.\n"
            "- Keep prep/setup tasks under 15 minutes and limit them to one slot so most of the time is spent on movement.\n"
            "- Name the precise drills (e.g., \"5x(2 min run / 1 min walk)\", \"90/90 hip switches\") and describe how to log effort.\n"
            "- Always include `count` or `times_per_week` inside each `cadence` object so scheduling can spread sessions across the entire week."
        ),
        "tasks": [
            {
                "title": "Stage running kit",
                "intent": "Signal commitment by staging shoes, clothes, bottle, and timer.",
                "note": "Lay everything out near the door so mornings stay effortless.",
                "duration": 10,
                "cadence": "flex",
            },
            {
                "title": "Run-walk interval: 30 minutes",
                "intent": "Introduce running with structured intervals to hit the target duration.",
                "note": "Alternate 2 min run / 1 min walk for 10 rounds; note effort 1-10.",
                "duration": 30,
                "cadence": {"type": "x_per_week", "count": 2, "times": ["morning"]},
            },
            {
                "title": "Mobility + strides",
                "intent": "Keep joints healthy and reinforce running form on non-run days.",
                "note": "10 min mobility (90/90 switches) plus 4 x 20-second strides.",
                "duration": 20,
                "cadence": {"type": "x_per_week", "count": 2, "times": ["morning"]},
            },
        ],
    },
    "habit": {
        "types": {"habit"},
        "keywords": {"routine", "mindful", "journal", "sleep", "morning", "evening"},
        "prompt_hint": (
            "### DOMAIN FOCUS: HABIT FORMATION\n"
            "- Anchor each task to a trigger (after coffee, before bed) and keep durations tiny.\n"
            "- Include one reflection/logging micro-task to reinforce identity wins."
        ),
        "tasks": [
            {
                "title": "Design habit trigger + environment",
                "intent": "Pair the habit with a reliable cue so it happens automatically.",
                "note": "Decide the cue (e.g., after brushing teeth) and stage supplies where the cue happens.",
                "duration": 10,
                "cadence": "flex",
            },
            {
                "title": "Two-minute starter rep",
                "intent": "Shrink the habit so starting feels effortless.",
                "note": "Run a 2-minute version of the habit daily to prove it fits (timer on phone).",
                "duration": 5,
                "cadence": {"type": "daily", "times": ["morning"]},
            },
            {
                "title": "Evening reflection note",
                "intent": "Capture one line about how the habit felt to reinforce identity.",
                "note": "Log a quick win or friction point in Notes before bed.",
                "duration": 5,
                "cadence": {"type": "daily", "times": ["evening"]},
            },
        ],
    },
    "project": {
        "types": {"project", "work"},
        "keywords": {"project", "launch", "deck", "presentation", "website", "build"},
        "prompt_hint": (
            "### DOMAIN FOCUS: PROJECT EXECUTION\n"
            "- Translate the goal into shippable sub-units (outline, draft, review) with explicit deliverables.\n"
            "- Include a visibility task (status note or review) so the user can course-correct quickly."
        ),
        "tasks": [
            {
                "title": "Reset workspace + capture blockers",
                "intent": "Clear physical and digital distractions before execution.",
                "note": "Archive stale tabs, dump blockers into a scratchpad, and reopen the project doc.",
                "duration": 15,
                "cadence": "flex",
            },
            {
                "title": "Draft outline for {goal_focus}",
                "intent": "Define the structure of the week’s deliverable before filling details.",
                "note": "Sketch bullet outline with intro/sections/outro; mark unknowns with '?' for follow-up.",
                "duration": 30,
                "cadence": {"type": "x_per_week", "count": 2, "times": ["morning"]},
            },
            {
                "title": "Ship micro-deliverable + summary",
                "intent": "Finish a tangible slice and log what changed.",
                "note": "Complete one section or ticket, then send a 3-bullet summary/report in your tracker.",
                "duration": 30,
                "cadence": {"type": "x_per_week", "count": 2, "times": ["evening"]},
            },
        ],
    },
    "skill_generic": {
        "types": {"skill", "learning"},
        "prompt_hint": (
            "### DOMAIN FOCUS: DELIBERATE PRACTICE\n"
            "- Break the skill into subskills, run focused drills, and capture one measurable takeaway per session."
        ),
        "tasks": [
            {
                "title": "Stage study/practice zone",
                "intent": "Remove friction by prepping tools, notes, and focus playlist.",
                "note": "Close irrelevant tabs, gather materials, and set a 30-minute timer.",
                "duration": 10,
                "cadence": "flex",
            },
            {
                "title": "Deliberate practice block: hardest subskill",
                "intent": "Attack the most intimidating part of {goal_focus} with intention.",
                "note": "Pick one micro-skill, run a 20-minute drill, and log accuracy or speed.",
                "duration": 25,
                "cadence": {"type": "x_per_week", "count": 3, "times": ["evening"]},
            },
            {
                "title": "Reflection + adjustments",
                "intent": "Integrate lessons so the next session improves.",
                "note": "Write 3 bullets: what worked, what needs help, what to try next.",
                "duration": 10,
                "cadence": {"type": "specific_days", "days": ["sunday"], "times": ["evening"]},
            },
        ],
    },
    "generic": {
        "prompt_hint": "",
        "tasks": [
            {
                "title": "Clarify outcome + definition of done",
                "intent": "Write down what success looks like so every task aligns.",
                "note": "List 2-3 objective signals that prove {goal_focus} progressed.",
                "duration": 15,
                "cadence": "flex",
            },
            {
                "title": "Protect one focus block",
                "intent": "Schedule time on the calendar dedicated to the goal.",
                "note": "Block a 25-minute session and silence notifications.",
                "duration": 25,
                "cadence": {"type": "x_per_week", "count": 3, "times": ["morning"]},
            },
            {
                "title": "Capture insights + next micro-step",
                "intent": "End Week 1 with clarity on what to adjust.",
                "note": "Log one win, one friction, and the smallest next action.",
                "duration": 10,
                "cadence": {"type": "specific_days", "days": ["sunday"], "times": ["evening"]},
            },
        ],
    },
}

TYPE_DEFAULT_TEMPLATE = {
    "skill": "skill_generic",
    "learning": "skill_generic",
    "habit": "habit",
    "health": "fitness",
    "fitness": "fitness",
    "project": "project",
    "work": "project",
}


def _detect_specialty_key(user_input: str | None, resolution_type: Optional[str]) -> str:
    text = (user_input or "").lower()
    normalized_type = (resolution_type or "").lower()
    for key, config in SPECIALTY_CONFIG.items():
        keywords = config.get("keywords")
        types = config.get("types")
        if keywords and any(keyword in text for keyword in keywords):
            if not types or not normalized_type or normalized_type in types:
                return key
    return TYPE_DEFAULT_TEMPLATE.get(normalized_type, "generic")


def _specialty_prompt_hint(user_input: str | None, resolution_type: Optional[str], refined_goal: Dict[str, Any]) -> str:
    key = _detect_specialty_key(user_input, resolution_type)
    base = SPECIALTY_CONFIG.get(key, {}).get("prompt_hint", "")
    requirements = _render_goal_requirements(refined_goal, for_specialty=True)
    if requirements:
        return f"{base}\n{requirements}".strip()
    return base


def _goal_focus_phrase(user_input: str | None) -> str:
    if not user_input:
        return "your goal"
    cleaned = user_input.strip()
    if not cleaned:
        return "your goal"
    tokens = cleaned.replace("\n", " ").split()
    snippet = " ".join(tokens[:6]).strip()
    return snippet or "your goal"


def _refine_resolution_goal(user_input: str, resolution_type: Optional[str]) -> Dict[str, Any]:
    text = user_input.lower()
    target_duration = _extract_duration_minutes(text)
    activity = _detect_activity(text, resolution_type)
    secondary_focuses = _detect_secondary_focuses(text, activity)
    target_frequency = _extract_frequency(text)
    return {
        "raw": user_input,
        "activity": activity,
        "secondary_focuses": secondary_focuses,
        "target_duration_min": target_duration,
        "target_frequency": target_frequency,
    }


def _extract_duration_minutes(text: str) -> Optional[int]:
    import re

    matches = re.findall(r"(\d+)\s*(?:minute|min|mins|minutes|hour|hr|hours)", text)
    if not matches:
        return None
    value = int(matches[0])
    if "hour" in text or "hr" in text:
        if value <= 3:
            return value * 60
    return value


def _extract_frequency(text: str) -> Optional[str]:
    if any(phrase in text for phrase in ["every day", "daily"]):
        return "daily"
    if "weekly" in text:
        return "weekly"
    if any(phrase in text for phrase in ["3x", "three times", "thrice"]):
        return "3x/week"
    if any(phrase in text for phrase in ["twice", "2x"]):
        return "2x/week"
    return None


def _detect_activity(text: str, resolution_type: Optional[str]) -> Optional[str]:
    for keyword, activity in ACTIVITY_KEYWORDS.items():
        if keyword in text:
            return activity
    normalized = (resolution_type or "").lower()
    if normalized in {"health", "fitness", "habit"} and "run" in text:
        return "running"
    return None


def _detect_secondary_focuses(text: str, primary: Optional[str]) -> List[str]:
    focus_set: set[str] = set()
    for keyword, activity in ACTIVITY_KEYWORDS.items():
        if activity == primary:
            continue
        if keyword in text:
            focus_set.add(activity)
    return sorted(focus_set)


def _render_goal_requirements(refined_goal: Dict[str, Any], *, for_specialty: bool = False) -> str:
    parts: List[str] = []
    activity = refined_goal.get("activity")
    target_duration = refined_goal.get("target_duration_min")
    target_frequency = refined_goal.get("target_frequency")
    secondary_focuses: List[str] = refined_goal.get("secondary_focuses") or []
    if activity and not for_specialty:
        parts.append(f"- Include tasks that explicitly involve {activity}.")
    if activity and target_duration:
        parts.append(
            f"- At least two Week 1 sessions must cover {activity} for around {target_duration} minutes "
            "(warm-up and cool-down can be shorter but total time should stay close to the target)."
        )
        parts.append("- Keep prep/setup tasks under 15 minutes so most time goes to the primary activity (limit to one quick setup task).")
        parts.append(f"- Never stack more than one substantial {activity} workout on the same day; alternate with mobility or recovery work.")
        parts.append("- Energy-balancing days (mobility, walks) should land between long sessions, not alongside them.")
    if not for_specialty and target_duration and not activity:
        parts.append(
            f"- At least one task must match the user's requested duration (~{target_duration} minutes)."
        )
    if target_frequency:
        parts.append(f"- Honor the requested cadence ({target_frequency}) whenever possible.")
    if secondary_focuses:
        focus_str = ", ".join(secondary_focuses)
        parts.append(
            f"- Dedicate separate days to {focus_str} so the user sees variety without burnout; never put {focus_str} on the same day as the primary workout."
        )
    if parts:
        header = "### USER REQUIREMENTS\n" if not for_specialty else ""
        return header + "\n".join(parts) + ("\n\n" if not for_specialty else "")
    return ""


def decompose_resolution_with_llm(
    user_input: str,
    duration_weeks: int,
    resolution_type: Optional[str] = None,
    user_context: Optional[Dict[str, Any]] = None,
    effort_band: str | None = None,
    band_rationale: str | None = None,
    request_id: str | None = None,
) -> dict:
    """Generate, evaluate, and optionally repair a resolution plan."""
    sanitized_weeks = max(4, min(12, duration_weeks))
    band_label = effort_band or "medium"
    band_rationale = band_rationale or "Defaulted effort band."
    trace_metadata = {
        "band": band_label,
        "resolution_type": resolution_type or "unspecified",
        "duration_weeks": sanitized_weeks,
        "request_id": request_id,
    }

    refined_goal = _refine_resolution_goal(user_input, resolution_type)
    api_key = settings.openai_api_key
    client = openai.OpenAI(api_key=api_key) if api_key else None
    if not client:
        print("OPENAI_API_KEY missing; using fallback plan.")
        plan_dict = _fallback_plan(user_input, sanitized_weeks, resolution_type, user_context, band_label, band_rationale, refined_goal)
        evaluation = _evaluate_with_observability(
            plan_dict,
            band_label,
            resolution_type,
            request_id,
            trace_metadata,
            refined_goal,
        )
        return _finalize_plan(plan_dict, evaluation, band_label, band_rationale, repair_used=False, fallback_used=True)

    system_prompt, base_user_prompt = _build_prompts(
        user_input=user_input,
        resolution_type=resolution_type,
        sanitized_weeks=sanitized_weeks,
        user_context=user_context,
        band_label=band_label,
        band_rationale=band_rationale,
        refined_goal=refined_goal,
    )
    plan_dict = _generate_plan_via_llm(
        client,
        system_prompt,
        base_user_prompt,
        resolution_type,
        user_context,
        trace_metadata,
        request_id,
    )
    print(f"Plan dict: {plan_dict}")
    evaluation = _evaluate_with_observability(plan_dict, band_label, resolution_type, request_id, trace_metadata, refined_goal)
    print(f"Evaluation: {evaluation}")
    repair_used = False
    regenerate_used = False
    fallback_used = False

    if not evaluation.passed and evaluation.repair_instructions:
        repair_used = True
        log_metric("plan.repair.used", 1, {"band": band_label})
        repaired = _repair_plan_via_llm(
            client,
            system_prompt,
            plan_dict,
            evaluation,
            resolution_type,
            user_context,
            trace_metadata,
            request_id,
        )
        if repaired:
            plan_dict = repaired
            evaluation = _evaluate_with_observability(plan_dict, band_label, resolution_type, request_id, trace_metadata, refined_goal)

    if not evaluation.passed and client:
        regenerate_used = True
        log_metric("plan.regenerate.used", 1, {"band": band_label})
        regenerated = _regenerate_plan_with_feedback(
            client=client,
            system_prompt=system_prompt,
            base_user_prompt=base_user_prompt,
            evaluation=evaluation,
            resolution_type=resolution_type,
            user_context=user_context,
            trace_metadata=trace_metadata,
            request_id=request_id,
        )
        if regenerated:
            plan_dict = regenerated
            evaluation = _evaluate_with_observability(plan_dict, band_label, resolution_type, request_id, trace_metadata, refined_goal)

    if not evaluation.passed:
        fallback_used = True
        log_metric("plan.fallback.used", 1, {"band": band_label})
        plan_dict = _fallback_plan(user_input, sanitized_weeks, resolution_type, user_context, band_label, band_rationale, refined_goal)
        evaluation = _evaluate_with_observability(plan_dict, band_label, resolution_type, request_id, trace_metadata, refined_goal)

    return _finalize_plan(plan_dict, evaluation, band_label, band_rationale, repair_used, regenerate_used, fallback_used)


def _build_prompts(
    *,
    user_input: str,
    resolution_type: Optional[str],
    sanitized_weeks: int,
    user_context: Optional[Dict[str, Any]],
    band_label: str,
    band_rationale: str,
    refined_goal: Dict[str, Any],
) -> tuple[str, str]:
    schema_json = json.dumps(ResolutionPlan.model_json_schema(), indent=2)
    # SYSTEM PROMPT: The "Sarathi" Persona
    system_prompt = (
        "You are Sarathi AI, a wise, supportive charioteer who values consistency over intensity. "
        "Your philosophy is Supportive Autonomy: clarity reduces anxiety and small wins compound.\n\n"
        "Role: Break down vague aspirations into a concrete, scientifically sound roadmap. "
        "You design behavior-change protocols, not generic to-do lists. "
        "Task titles must be concise (3-8 words) and may never contain vague placeholder text."
    )

    # CONTEXT PREPARATION
    context_payload = json.dumps(user_context, indent=2) if user_context else "Not provided"
    band_budget = EFFORT_BAND_BUDGETS.get(band_label, EFFORT_BAND_BUDGETS["medium"])
    minutes_low, minutes_high = band_budget["minutes_per_day"]
    weekly_cap = band_budget["weekly_minutes"]
    tasks_low, tasks_high = band_budget.get("tasks_per_day", (1, 2))
    cadence_hint = (
        "- Habit/health/skill goals must include at least one repeating practice task in Week 1 "
        "(daily or >=5x/week) so the reviewer sees real consistency.\n"
        if resolution_type in {"habit", "health", "skill", "learning"}
        else ""
    )
    hard_constraints = (
        "### HARD CONSTRAINTS (FlowBuddy rejects plans that break these)\n"
        f"- Week 1 workload must stay between {minutes_low}-{minutes_high} minutes per day and never exceed {weekly_cap} minutes per week.\n"
        f"- Keep daily task counts between {tasks_low}-{tasks_high}; never schedule more than {tasks_high} tasks on a single day.\n"
        f"{cadence_hint}"
        "- Task titles must remain concrete (binary done/not-done) and may not include vague verbs like 'work on' or 'try to'.\n"
        "- Violating any of the above means the reviewer will request a new plan, so comply."
    )
    specialty_hint = _specialty_prompt_hint(user_input, resolution_type, refined_goal)
    specialty_block = f"{specialty_hint}\n\n" if specialty_hint else ""
    requirements_block = _render_goal_requirements(refined_goal)
    # USER PROMPT: The "Planner" Logic
    user_prompt = (
        f"User Goal: '{user_input.strip()}'\n"
        f"Resolution Type (Hint): {resolution_type or 'Unspecified (Please infer)'}\n"
        f"Duration: {sanitized_weeks} weeks.\n"
        f"Context: {context_payload}\n"
        f"Effort Band: {band_label} (Budget: {minutes_low}-{minutes_high} min/day, Max {weekly_cap} min/week).\n\n"
        
        "### STEP 1: CATEGORY DIAGNOSIS\n"
        "Analyze the goal and apply the correct psychological framework:\n"
        "1. **HABIT/HEALTH (e.g., 'Run 5k', 'Meditate'):**\n"
        "   - Focus: Frequency > Intensity.\n"
        "   - Week 1 Strategy: 'The Show Up'. Keep duration short, focus on the trigger and starting.\n"
        "2. **SKILL/LEARNING (e.g., 'Learn Python', 'Play Guitar'):**\n"
        "   - Focus: Deliberate Practice > Passive Consumption.\n"
        "   - Rule: Limit 'Watching/Reading' to 30%. 70% must be 'Doing/Building'.\n"
        "3. **PROJECT/OUTCOME (e.g., 'Launch Website', 'Clean Garage'):**\n"
        "   - Focus: Deliverables > Activity.\n"
        "   - Strategy: Break the final outcome into weekly 'Shippable Units'.\n\n"

        "### STEP 2: WEEK 1 DESIGN (THE COLD START)\n"
        "Users fail because Week 1 is too hard. Your job is to remove friction.\n"
        "- **Task 1 MUST be 'Environment Design':** (e.g., 'Set up desk', 'Buy shoes', 'Download app').\n"
        "- **NO 'Vague' Verbs:** Ban words like 'Study', 'Work on', 'Try'. Use binary verbs: 'Write', 'Read', 'Run', 'Commit'.\n"
        "- **Success Signal:** Every task must have a clear 'Done' state.\n\n"

        "### STEP 3: SCHEDULING RULES\n"
        "- **Cadence:** Use the 'cadence' object strictly. For habits, prefer 'daily' or 'x_per_week' (min 3).\n"
        f"- **Load:** Do NOT exceed {minutes_high} minutes per day. If the goal requires more, EXTEND the timeline, do not burn out the user.\n\n"
        f"{hard_constraints}\n\n"
        f"{requirements_block}"
        f"{specialty_block}"
        "### OUTPUT REQUIREMENT\n"
        "Return strictly valid JSON matching this schema:\n"
        f"{schema_json}"
    )
    return system_prompt, user_prompt


def _generate_plan_via_llm(
    client,
    system_prompt: str,
    user_prompt: str,
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
    trace_metadata: Dict[str, Any],
    request_id: Optional[str],
) -> Dict[str, Any]:
    with trace("plan.generate", metadata=trace_metadata, request_id=request_id):
        completion = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
    content = completion.choices[0].message.content or "{}"
    plan = ResolutionPlan.model_validate_json(content)
    plan_dict = plan.model_dump()
    return _post_process_plan(plan_dict, resolution_type, user_context)


def _repair_plan_via_llm(
    client,
    system_prompt: str,
    failed_plan: Dict[str, Any],
    evaluation: EvaluationResult,
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
    trace_metadata: Dict[str, Any],
    request_id: Optional[str],
) -> Optional[Dict[str, Any]]:
    repair_prompt = (
        "The earlier plan violated FlowBuddy guardrails. Please revise it minimally so it fits the effort band budgets "
        "and resolves the issues called out below. Preserve the supportive tone and keep tasks concrete.\n\n"
        f"Evaluation Summary:\n{json.dumps(evaluation.to_dict(), indent=2)}\n\n"
        f"Original Plan JSON:\n{json.dumps(failed_plan, indent=2)}"
    )
    try:
        with trace("plan.repair", metadata=trace_metadata, request_id=request_id):
            completion = client.chat.completions.create(
                model="gpt-4o",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": repair_prompt},
                ],
            )
        content = completion.choices[0].message.content or "{}"
        plan = ResolutionPlan.model_validate_json(content)
        plan_dict = plan.model_dump()
        return _post_process_plan(plan_dict, resolution_type, user_context)
    except Exception:  # pragma: no cover - defensive
        return None


def _regenerate_plan_with_feedback(
    client,
    system_prompt: str,
    base_user_prompt: str,
    evaluation: EvaluationResult,
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
    trace_metadata: Dict[str, Any],
    request_id: Optional[str],
) -> Optional[Dict[str, Any]]:
    feedback = _format_evaluation_feedback(evaluation)
    augmented_prompt = (
        f"{base_user_prompt}\n\n"
        "### REVIEWER FEEDBACK (previous plan rejected)\n"
        f"The earlier plan scored {evaluation.score} and violated:\n{feedback}\n"
        "Generate a brand-new plan from scratch that satisfies every guardrail above. "
        "Do not reuse the previous plan; prioritize the user staying within budget."
    )
    try:
        plan_dict = _generate_plan_via_llm(
            client,
            system_prompt,
            augmented_prompt,
            resolution_type,
            user_context,
            trace_metadata,
            request_id,
        )
        return plan_dict
    except Exception:  # pragma: no cover - defensive
        return None


def _post_process_plan(
    plan_dict: Dict[str, Any],
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    enriched_week1 = _enrich_tasks_with_schedule(
        plan_dict.get("week_1_tasks", []),
        resolution_type,
        user_context,
        repeat_daily=True,
    )
    plan_dict["week_1_tasks"] = enriched_week1
    if not plan_dict.get("weeks"):
        plan_dict["weeks"] = [
            {
                "week": milestone.get("week_number") or milestone.get("week"),
                "focus": milestone.get("focus_summary") or milestone.get("focus"),
                "tasks": enriched_week1 if idx == 0 else [],
            }
            for idx, milestone in enumerate(plan_dict.get("milestones", []))
        ]
    else:
        first_week = plan_dict["weeks"][0] if plan_dict["weeks"] else None
        if first_week is not None:
            first_week["tasks"] = enriched_week1
    return plan_dict


def _evaluate_with_observability(
    plan_dict: Dict[str, Any],
    band_label: str,
    resolution_type: Optional[str],
    request_id: Optional[str],
    trace_metadata: Dict[str, Any],
    goal_requirements: Dict[str, Any],
) -> EvaluationResult:
    with trace("plan.evaluate", metadata=trace_metadata, request_id=request_id):
        result = evaluate_plan(plan_dict, band_label, resolution_type, goal_requirements)
    metadata = {"band": band_label}
    log_metric("plan.eval.score", result.score, metadata)
    log_metric("plan.eval.passed", 1 if result.passed else 0, metadata)
    log_metric("plan.eval.vagueness_count", len(result.vagueness_flags), metadata)
    log_metric("plan.eval.budget_violations_count", len(result.budget_violations), metadata)
    return result


def _finalize_plan(
    plan_dict: Dict[str, Any],
    evaluation: EvaluationResult,
    band_label: str,
    band_rationale: str,
    repair_used: bool,
    regenerate_used: bool,
    fallback_used: bool,
) -> Dict[str, Any]:
    plan_dict["band"] = band_label
    plan_dict["band_rationale"] = band_rationale
    summary = evaluation.to_dict()
    summary["repair_used"] = repair_used
    summary["regenerate_used"] = regenerate_used
    summary["fallback_used"] = fallback_used
    plan_dict["evaluation_summary"] = summary
    plan_dict["week_1_tasks"] = [_public_task_data(task) for task in plan_dict.get("week_1_tasks", [])]
    for section in plan_dict.get("weeks", []):
        section["tasks"] = [_public_task_data(task) for task in section.get("tasks", [])]
    return plan_dict


def _format_evaluation_feedback(evaluation: EvaluationResult) -> str:
    lines: List[str] = []
    if evaluation.budget_violations:
        lines.append(f"- Budget: {'; '.join(evaluation.budget_violations)}")
    if evaluation.vagueness_flags:
        lines.append(f"- Vague tasks: {', '.join(evaluation.vagueness_flags)}")
    if evaluation.cadence_issues:
        lines.append(f"- Cadence: {'; '.join(evaluation.cadence_issues)}")
    if evaluation.overload_warnings:
        lines.append(f"- Overload: {'; '.join(evaluation.overload_warnings)}")
    if not lines:
        lines.append("- Reviewer did not provide additional details, but score was below threshold.")
    return "\n".join(lines)


def _public_task_data(task: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = dict(task)
    cadence_struct = cleaned.get("_cadence_struct")
    if isinstance(cleaned.get("cadence"), dict):
        cadence_struct = cadence_struct or cleaned.get("cadence")
    if isinstance(cadence_struct, dict):
        cleaned["cadence"] = _stringify_cadence(cadence_struct)
    cleaned.pop("_cadence_struct", None)
    return cleaned


def _stringify_cadence(struct: Dict[str, Any]) -> str:
    normalized = _normalize_cadence_struct(struct)
    cadence_type = normalized.get("type") or normalized.get("cadence") or ""
    count = normalized.get("count") or normalized.get("times_per_week")
    days = normalized.get("days")
    if cadence_type == "daily":
        return "daily"
    if cadence_type in {"one_time", "once"}:
        return "once"
    if cadence_type in {"x_per_week", "times_per_week"} and count:
        return f"{count}x per week"
    if cadence_type.endswith("x_per_week"):
        prefix = cadence_type.split("x")[0]
        if prefix.isdigit():
            return f"{prefix}x per week"
    if cadence_type in {"specific_days"} and days:
        readable_days = ", ".join(str(day).capitalize() for day in days)
        return f"Specific days: {readable_days}"
    return cadence_type or "flex"


def _normalize_cadence_struct(struct: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(struct)
    cadence_type = str(normalized.get("type") or normalized.get("cadence") or "").lower()
    count = _coerce_positive_int(normalized.get("count") or normalized.get("times_per_week"))
    days = normalized.get("days")
    if cadence_type in {"once_per_week"}:
        cadence_type = "x_per_week"
        count = count or 1
    elif cadence_type in {"twice_per_week", "two_per_week", "2x_per_week", "2x_in_week"}:
        cadence_type = "x_per_week"
        count = count or 2
    elif cadence_type in {"thrice_per_week", "three_per_week", "3x_per_week", "3x_in_week"}:
        cadence_type = "x_per_week"
        count = count or 3
    elif cadence_type in {"weekly"}:
        cadence_type = "x_per_week"
        count = count or 1
    if not cadence_type:
        if count:
            cadence_type = "x_per_week"
        elif days:
            cadence_type = "specific_days"
        else:
            cadence_type = "flex"
    normalized["type"] = cadence_type
    if count:
        normalized["count"] = count
    if days:
        normalized["days"] = [str(day).strip().lower() for day in days if isinstance(day, str)]
    return normalized


def _coerce_positive_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return 1 if value else None
    try:
        num = int(value)
        return num if num > 0 else None
    except (TypeError, ValueError):
        return None


def _fallback_plan(
    user_input: str,
    duration_weeks: int,
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
    band: str,
    band_rationale: str,
    refined_goal: Dict[str, Any],
) -> dict:
    """Return a deterministic plan when LLM calls are unavailable."""
    title = user_input.strip() or "FlowBuddy Goal"
    weeks = max(4, min(12, duration_weeks or 8))
    specialty_key = _detect_specialty_key(user_input, resolution_type)
    specialty_config = SPECIALTY_CONFIG.get(specialty_key, SPECIALTY_CONFIG["generic"])
    task_templates = specialty_config.get("tasks") or SPECIALTY_CONFIG["generic"]["tasks"]
    goal_focus = _goal_focus_phrase(user_input)
    milestones: List[WeeklyMilestone] = []
    focus_templates = [
        "Ground yourself and set a compassionate baseline.",
        "Design tiny rituals that keep momentum alive.",
        "Practice the core habit consistently with checkpoints.",
        "Review progress and celebrate micro wins.",
    ]
    for week in range(1, weeks + 1):
        focus = focus_templates[min(week - 1, len(focus_templates) - 1)]
        milestones.append(
            WeeklyMilestone(
                week_number=week,
                focus_summary=f"{focus} (Week {week})",
            )
        )

    week_tasks_raw = [
        TaskDraft(
            title=_format_template_text(template.get("title", "Week task"), goal_focus),
            intent=_format_template_text(template.get("intent", "Focus intentionally."), goal_focus),
            estimated_duration_min=int(template.get("duration") or _default_duration(resolution_type)),
            cadence=template.get("cadence") or _default_cadence(resolution_type),
            note=_format_template_text(template.get("note"), goal_focus),
        )
        for template in task_templates
    ]

    enriched_tasks = _enrich_tasks_with_schedule(
        [task.model_dump() for task in week_tasks_raw],
        resolution_type,
        user_context,
        repeat_daily=False,
    )

    week_sections = [
        PlanWeekSection(
            week=milestone.week_number,
            focus=milestone.focus_summary,
            tasks=[TaskDraft(**_public_task_data(task)) for task in enriched_tasks] if milestone.week_number == 1 else [],
        )
        for milestone in milestones
    ]

    plan = ResolutionPlan(
        resolution_title=title if len(title) < 120 else f"{title[:117]}...",
        why_this_matters="Sarathi AI reminder: name the emotional stake so motivation feels grounded.",
        duration_weeks=weeks,
        milestones=milestones,
        week_1_tasks=[TaskDraft(**_public_task_data(task)) for task in enriched_tasks],
        weeks=week_sections,
        band=band,
        band_rationale=band_rationale,
        evaluation_summary={},
    )
    return plan.model_dump()


def _format_template_text(value: Optional[str], goal_focus: str) -> Optional[str]:
    if value is None:
        return None
    try:
        return value.format(goal_focus=goal_focus)
    except Exception:
        return value


def _default_duration(resolution_type: Optional[str]) -> int:
    normalized = (resolution_type or "").lower()
    if normalized in {"habit", "skill", "learning"}:
        return 30
    if normalized in {"health", "fitness"}:
        return 25
    if normalized in {"project", "work"}:
        return 45
    return 30


def _default_cadence(resolution_type: Optional[str]) -> str:
    normalized = (resolution_type or "").lower()
    if normalized in {"habit", "skill", "learning"}:
        return "daily performance windows"
    if normalized in {"health", "fitness"}:
        return "5x weekly mornings"
    return "3-4x weekly focus blocks"


def _enrich_tasks_with_schedule(
    tasks: List[Dict[str, Any]],
    resolution_type: Optional[str],
    user_context: Optional[Dict[str, Any]],
    repeat_daily: bool = True,
) -> List[Dict[str, Any]]:
    today = date.today()
    week_start = today
    preferred_days = _normalize_days((user_context or {}).get("preferred_days"))
    preferred_blocks = (user_context or {}).get("preferred_time_blocks") or []
    work_hours = (user_context or {}).get("work_hours")
    confidence = _confidence_level(preferred_days, preferred_blocks)

    time_pref = _preferred_time_for_resolution(resolution_type, preferred_blocks)
    daily_load: Dict[date, List[int]] = {}
    last_long_day: Optional[date] = None
    daily_time_slots: Dict[date, set[str]] = {}

    enriched: List[Dict[str, Any]] = []
    for original in tasks:
        base = dict(original)
        duration = _extract_duration(base)
        cadence_struct = _build_cadence_struct(base.get("cadence"))
        target_days = _expand_target_days(cadence_struct, week_start, repeat_daily, base.get("scheduled_day"))
        if not target_days:
            target_days = [week_start]
        for target_day in target_days:
            candidate_day = _schedule_on_or_after(
                target_day,
                preferred_days,
                duration,
                daily_load,
                last_long_day,
            )
            if duration and duration > 60:
                last_long_day = candidate_day

            base_time = _pick_time(time_pref, work_hours)
            used_times = daily_time_slots.setdefault(candidate_day, set())
            suggested_time = _find_free_time_slot(base_time, used_times)
            iso_day = candidate_day.isoformat() if candidate_day else None
            clone = dict(base)
            clone["suggested_day"] = iso_day
            clone["suggested_time"] = suggested_time
            clone["scheduled_day"] = iso_day
            clone["scheduled_time"] = suggested_time
            clone["estimated_duration_min"] = duration
            clone["confidence"] = confidence
            clone.setdefault("note", base.get("note"))
            clone["_cadence_struct"] = cadence_struct
            enriched.append(clone)
    return enriched

def _build_cadence_struct(raw) -> Dict[str, Any]:
    if isinstance(raw, dict):
        struct = dict(raw)
        struct.setdefault("times", struct.get("times") or ["morning"])
        if struct.get("type"):
            struct["type"] = str(struct["type"]).lower()
        return _normalize_cadence_struct(struct)
    if isinstance(raw, str):
        return _normalize_cadence_struct({"type": raw.lower(), "times": ["morning"]})
    return _normalize_cadence_struct({"type": "flex", "times": ["morning"]})


def _extract_duration(task: Dict[str, Any]) -> int:
    value = task.get("estimated_duration_min") or task.get("duration_min")
    if isinstance(value, (int, float)):
        return int(value)
    return 30


def _normalize_days(raw_days) -> List[int]:
    if not raw_days:
        return []
    mapping = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    normalized = []
    for day in raw_days:
        if isinstance(day, str):
            key = day.strip().lower()
            if key in mapping:
                normalized.append(mapping[key])
    return normalized


def _confidence_level(preferred_days, preferred_blocks) -> str:
    if preferred_days and preferred_blocks:
        return "high"
    if preferred_days or preferred_blocks:
        return "medium"
    return "low"


def _preferred_time_for_resolution(resolution_type: Optional[str], user_blocks: List[str]) -> str:
    block_map = {
        "morning": "07:30",
        "afternoon": "13:00",
        "evening": "19:00",
        "night": "21:00",
    }
    if user_blocks:
        first = user_blocks[0].strip().lower()
        return block_map.get(first, "09:00")

    normalized = (resolution_type or "").lower()
    if normalized in {"habit", "health", "fitness"}:
        return "07:30"
    if normalized in {"skill", "learning", "project", "hobby"}:
        return "19:00"
    return "10:00"


def _pick_time(preferred_time: str, work_hours: Optional[str]) -> str:
    if not work_hours:
        return preferred_time
    # simplistic guard: if preferred time overlaps work hours described as "09:00-17:00", pick evening
    try:
        start, end = [segment.strip() for segment in work_hours.split("-")]
        pref_hour = int(preferred_time.split(":")[0])
        if int(start.split(":")[0]) <= pref_hour < int(end.split(":")[0]):
            return "18:30"
    except Exception:
        return preferred_time
    return preferred_time


def _find_free_time_slot(base_time: str, used_times: set[str]) -> str:
    """Avoid double-booking the same time slot by nudging in 30-minute increments."""
    base_minutes = _time_str_to_minutes(base_time)
    for offset in range(5):
        candidate = _minutes_to_time(base_minutes + offset * 30)
        if candidate not in used_times:
            used_times.add(candidate)
            return candidate
    used_times.add(base_time)
    return base_time


def _time_str_to_minutes(value: str) -> int:
    try:
        hours, minutes = [int(part) for part in value.split(":")]
        return (hours * 60) + minutes
    except Exception:
        return 8 * 60


def _minutes_to_time(total_minutes: int) -> str:
    total_minutes %= 24 * 60
    hours = total_minutes // 60
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _schedule_on_or_after(
    target_day: date,
    preferred_days: List[int],
    duration: int,
    daily_load: Dict[date, List[int]],
    last_long_day: Optional[date],
) -> date:
    day = target_day
    max_checks = 21
    for _ in range(max_checks):
        weekday = day.weekday()
        matches_preference = not preferred_days or weekday in preferred_days
        load = daily_load.setdefault(day, [])
        effective_load = len([d for d in load if d >= 15])
        long_conflict = duration > 60 and last_long_day and (day - last_long_day).days <= 1
        if matches_preference and effective_load < 2 and not long_conflict:
            load.append(duration)
            return day
        day += timedelta(days=1)
    daily_load.setdefault(target_day, []).append(duration)
    return target_day


def _expand_target_days(
    cadence_struct: Dict[str, Any],
    week_start: date,
    repeat_daily: bool,
    first_day_hint: Optional[str],
) -> List[date]:
    cadence_type = str(cadence_struct.get("type") or cadence_struct.get("cadence") or "").lower()
    days: List[date] = []
    hint_date = _parse_iso_date(first_day_hint) if first_day_hint else None
    if cadence_type == "daily" or (repeat_daily and "daily" in cadence_type):
        days = [week_start + timedelta(days=i) for i in range(7)]
    elif cadence_type == "specific_days":
        raw_days = cadence_struct.get("days") or []
        normalized = _normalize_days(raw_days)
        for idx in normalized:
            offset = (idx - week_start.weekday()) % 7
            days.append(week_start + timedelta(days=offset))
    elif cadence_type in {"x_per_week", "times_per_week"}:
        count = int(cadence_struct.get("count") or cadence_struct.get("times_per_week") or 1)
        days.extend(_evenly_spaced_days(count, week_start))
    elif cadence_type.endswith("x_per_week"):
        try:
            count = int(cadence_type.split("x")[0])
        except Exception:
            count = 1
        days.extend(_evenly_spaced_days(count, week_start))
    elif cadence_type in {"2x_in_week", "3x_in_week"}:
        try:
            count = int(cadence_type.split("x")[0])
        except Exception:
            count = 1
        days.extend(_evenly_spaced_days(count, week_start))
    elif cadence_type in {"once", "one_time"}:
        days = [week_start]
    elif cadence_type in {"twice", "twice_per_week", "two_per_week"}:
        days.extend(_evenly_spaced_days(2, week_start))
    elif cadence_type in {"thrice", "thrice_per_week", "three_per_week"}:
        days.extend(_evenly_spaced_days(3, week_start))
    elif cadence_type in {"once_per_week", "one_time", "once"}:
        days = [week_start]
    elif cadence_type in {"twice_per_week", "two_per_week"}:
        days.extend(_evenly_spaced_days(2, week_start))
    elif cadence_type in {"thrice_per_week", "three_per_week"}:
        days.extend(_evenly_spaced_days(3, week_start))
    elif cadence_type == "once":
        days = [week_start]
    else:
        days = [week_start]
    return sorted({day for day in days if day})


def _evenly_spaced_days(count: int, week_start: date) -> List[date]:
    if count <= 1:
        return [week_start]
    count = max(1, min(count, 7))
    spacing = 7 / count
    days = []
    for i in range(count):
        offset = min(6, int(round(i * spacing)))
        days.append(week_start + timedelta(days=offset))
    return days


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        parts = value.split("T")[0].split("-")
        if len(parts) != 3:
            return None
        year, month, day = map(int, parts)
        return date(year, month, day)
    except Exception:
        return None
