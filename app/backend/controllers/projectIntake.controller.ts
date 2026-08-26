import { Request, Response } from "express";
import { z } from "zod";
import { buildProjectIntake } from "../../modules/project-intake/service";

const classifyScopeSchema = z.object({
  scope: z.string().trim().min(1, "scope is required"),
});

// Deterministic scope -> IntakeResult classification (Sprint 002's engine).
// No OpenAI call here — see modules/project-intake/service.ts.
export const projectIntakeController = {
  async classify(req: Request, res: Response) {
    const { scope } = classifyScopeSchema.parse(req.body ?? {});
    res.json(buildProjectIntake(scope));
  },
};
