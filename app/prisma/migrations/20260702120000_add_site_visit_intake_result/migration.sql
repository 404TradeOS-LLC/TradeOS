-- Persists the full deterministic IntakeResult (trade, projectType, category,
-- missingInformation, followUpQuestions, confidenceScore, proposalDraft) from
-- modules/project-intake/service.ts#buildProjectIntake() against the site
-- visit that produced it. The pre-existing ai_questions_json/missing_info_json/
-- confidence_score columns remain populated too (derived from the same
-- result), so any existing consumer of those columns keeps working unchanged.
alter table site_visits add column if not exists intake_result_json jsonb;
