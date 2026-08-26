import type { TraininglessEstimateDraft } from "./types";
import { buildTraininglessEstimateDemo } from "./matcher";

export class TraininglessEstimateDemoService {
  run(scopeText: string): TraininglessEstimateDraft {
    return buildTraininglessEstimateDemo(scopeText);
  }
}
