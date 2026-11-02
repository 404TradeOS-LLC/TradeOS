/**
 * Bound for every CRM overview source read. The overview page awaits all five
 * sources before rendering anything, so without a bound a single hung fetch
 * shows as an endless skeleton. 20 seconds sits inside the 15–30 second
 * range: long enough for a slow backend, short enough that a stalled page
 * degrades to the existing per-source fallback banner instead of hanging.
 */
export const CRM_SOURCE_TIMEOUT_MS = 20_000;

/** Creates the bounded AbortSignal shared by all five CRM overview reads. */
export function createCrmLoadSignal(): AbortSignal {
  return AbortSignal.timeout(CRM_SOURCE_TIMEOUT_MS);
}

type CrmLoaders<TProjects, TCustomers, TTasks, TProposals, TEvents> = {
  listProjects: (token: string, signal: AbortSignal) => Promise<TProjects>;
  listCustomers: (token: string, signal: AbortSignal) => Promise<TCustomers>;
  listOrganizationProjectTasks: (token: string, signal: AbortSignal) => Promise<TTasks>;
  listProposalQueue: (token: string, signal: AbortSignal) => Promise<TProposals>;
  listActivityEvents: (token: string, signal: AbortSignal) => Promise<TEvents>;
};

/**
 * Loads the five CRM overview sources with one shared bounded cancellation
 * signal. Results are settled individually — a timed-out or failed source
 * comes back rejected so the page's existing per-source fallback banner can
 * name it, instead of the whole page hanging or failing.
 */
export async function loadCrmPageData<TProjects, TCustomers, TTasks, TProposals, TEvents>(
  token: string,
  loaders: CrmLoaders<TProjects, TCustomers, TTasks, TProposals, TEvents>,
  signal: AbortSignal = createCrmLoadSignal(),
) {
  return Promise.allSettled([
    loaders.listProjects(token, signal),
    loaders.listCustomers(token, signal),
    loaders.listOrganizationProjectTasks(token, signal),
    loaders.listProposalQueue(token, signal),
    loaders.listActivityEvents(token, signal),
  ]);
}

type CustomersLoaders<TCustomer, TSettings> = {
  listCustomers: (token: string) => Promise<TCustomer[]>;
  getOrganizationSettings: (token: string) => Promise<TSettings>;
};

/**
 * Loads the customers directory data. A list failure degrades to an empty
 * list plus a failure flag — the page renders its fallback banner instead
 * of failing outright. The settings read keeps its existing null-on-error
 * behavior, so the success path is unchanged.
 */
export async function loadCustomersPageData<TCustomer, TSettings>(
  token: string,
  loaders: CustomersLoaders<TCustomer, TSettings>,
) {
  const [customersOutcome, settings] = await Promise.all([
    loaders.listCustomers(token).then(
      (customers) => ({ customers, customersFailed: false }),
      () => ({ customers: [] as TCustomer[], customersFailed: true }),
    ),
    loaders.getOrganizationSettings(token).catch(() => null),
  ]);
  return { ...customersOutcome, settings };
}
