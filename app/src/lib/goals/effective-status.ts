export type GoalStoredStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "achieved"
  | "cancelled";

export type GoalComputedStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "achieved"
  | "cancelled";

type GoalStatusInput = {
  status: GoalStoredStatus;
  current_value: number;
  target_value: number;
  period_start: string;
  period_end: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toSafeDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

export function goalProgressPercent(currentValue: number, targetValue: number) {
  if (targetValue <= 0) return 0;
  return clamp(Math.round((currentValue / targetValue) * 100), 0, 100);
}

export function getComputedGoalStatus(goal: GoalStatusInput): GoalComputedStatus {
  if (goal.status === "draft" || goal.status === "achieved" || goal.status === "cancelled") {
    return goal.status;
  }

  const progress = goalProgressPercent(goal.current_value, goal.target_value);
  const now = Date.now();
  const start = toSafeDate(goal.period_start).getTime();
  const end = toSafeDate(goal.period_end).getTime();

  if (now > end && progress < 100) {
    return "at_risk";
  }

  const duration = Math.max(1, end - start);
  const elapsedRatio = clamp((now - start) / duration, 0, 1);
  const expectedProgress = Math.round(elapsedRatio * 100);
  const tolerance = 10;

  if (progress < expectedProgress - tolerance) {
    return "at_risk";
  }

  return "active";
}

export function getEditableGoalStatus(status: GoalStoredStatus) {
  if (status === "at_risk") return "active" as const;
  return status;
}

