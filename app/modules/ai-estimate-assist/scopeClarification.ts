import { prisma } from "../../db/client";
import type { EstimateScopeClarification } from "./types";

const footingQuestion = {
  questionKey: "existing-deck-footing-site-check.v1",
  question: "Have the footings been checked?",
};

export function scopeClarificationQuestion(scope: string) {
  if (!/\bdeck\b/i.test(scope)) return null;
  const concernsFootings = /\bfootings?\b/i.test(scope);
  const structuralDeckWork = /\b(?:build|construct|replace|rebuild|extend)\s+(?:[\w×'-]+\s+){0,5}deck\b|\bdeck\s+(?:build|construction|replacement|extension)\b/i.test(scope);
  if (!concernsFootings && !structuralDeckWork) return null;
  // The question concerns reusing footings. An explicit new-footings scope
  // already addresses replacement unless it also mentions existing footings.
  if (/\bnew\s+(?:(?:concrete|deck)\s+)?footings?\b/i.test(scope)
    && !/\b(?:reuse|reusing|existing)\b/i.test(scope)) return null;
  return footingQuestion;
}

export async function resolveScopeClarification(
  estimateId: string,
  orgId: string,
  scope: string,
): Promise<EstimateScopeClarification | null> {
  const question = scopeClarificationQuestion(scope);
  if (!question) return null;

  const saved = await prisma.estimateScopeClarification.findFirst({
    where: { estimateId, questionKey: question.questionKey, estimate: { orgId } },
  });
  if (!saved) return { ...question, revision: 0, answer: null };
  return {
    questionKey: saved.questionKey,
    question: saved.question,
    revision: saved.revision,
    answer: saved.answerKind === "details" && saved.detail !== null
      ? { kind: "details", detail: saved.detail }
      : { kind: "site_check_assumption" },
  };
}
