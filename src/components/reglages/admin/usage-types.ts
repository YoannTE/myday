// Types du journal d'usage admin - reflète exactement les modèles Pydantic
// de backend/app/models/admin_usage.py (contrat FIGÉ, snake_case).

export interface WeekActivity {
  semaine: string;
  jours_actifs: number;
}

export interface UserActiveDays {
  user_label: string;
  weeks: WeekActivity[];
}

export interface AgentCost {
  agent: string;
  cost_usd: number;
  tokens: number;
}

export interface LlmCostResponse {
  total_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  by_agent: AgentCost[];
}

export interface AdminUsageResponse {
  active_days_by_user: UserActiveDays[];
  events_by_type: Record<string, number>;
  llm_cost: LlmCostResponse;
  active_users: number;
}
