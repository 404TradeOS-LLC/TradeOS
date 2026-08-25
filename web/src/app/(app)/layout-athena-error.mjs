export function handleAthenaNavLookupFailure(error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.warn("AppLayout: Athena nav visibility lookup timed out; hiding Athena navigation");
  } else {
    console.error("AppLayout: failed to resolve Athena nav visibility", error);
  }
  return false;
}
