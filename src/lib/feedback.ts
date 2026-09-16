//* shared by /feedback form & /api/feedback route so categories & limits can't drift - must mirror check constraints in supabase/schema.sql

export const FEEDBACK_CATEGORIES = ['bug', 'suggestion', 'data', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Something is broken',
  suggestion: 'Feature suggestion',
  data: 'Wrong / missing toilet data',
  other: 'Other',
};

export const FEEDBACK_LIMITS = {
  message: 1000,
  contact: 200,
} as const;
