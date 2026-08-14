import { EstimateEngineService } from "../estimate-engine/service";
import { JobsService } from "../jobs/service";
import { ProposalsService } from "../proposals/service";
import { runWithRequiredCanonicalEvents } from "./transactionalContext";

export class TransactionalEstimateEngineService extends EstimateEngineService {
  override create(...args: Parameters<EstimateEngineService["create"]>) {
    return runWithRequiredCanonicalEvents(["EstimateStarted"], () => super.create(...args));
  }

  override finalize(...args: Parameters<EstimateEngineService["finalize"]>) {
    return runWithRequiredCanonicalEvents(["EstimateCompleted"], () => super.finalize(...args));
  }
}

export class TransactionalJobsService extends JobsService {
  override schedule(...args: Parameters<JobsService["schedule"]>) {
    return runWithRequiredCanonicalEvents(["JobScheduled"], () => super.schedule(...args));
  }

  override addAssignment(...args: Parameters<JobsService["addAssignment"]>) {
    return runWithRequiredCanonicalEvents(["TechnicianAssigned"], () => super.addAssignment(...args));
  }

  override complete(...args: Parameters<JobsService["complete"]>) {
    return runWithRequiredCanonicalEvents(["WorkCompleted"], () => super.complete(...args));
  }
}

export class TransactionalProposalsService extends ProposalsService {
  override send(...args: Parameters<ProposalsService["send"]>) {
    return runWithRequiredCanonicalEvents(["ProposalSent"], () => super.send(...args));
  }
}
