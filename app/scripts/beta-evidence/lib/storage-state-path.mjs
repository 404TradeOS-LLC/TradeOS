// Containment check for authenticated storage state.
//
// A storage state written inside the working tree is one `git add -A` away
// from committing a live session, so the path is validated before anything
// writes to it.
//
// `path.resolve` is purely lexical: it does not follow symbolic links. A path
// that looks external can therefore traverse a symlinked directory pointing
// back into the repository, and the write still lands in the working tree.
// The real filesystem location is what matters, so the deepest existing
// ancestor is resolved with `fs.realpath` before the comparison.

import fs from "node:fs/promises";
import path from "node:path";

export class StorageStatePathError extends Error {
  constructor(message) {
    super(message);
    this.name = "StorageStatePathError";
    this.code = "STORAGE_STATE_INSIDE_REPOSITORY";
  }
}

/**
 * Resolve the nearest ancestor of `target` that exists on disk, following
 * symbolic links. The state file itself normally does not exist yet, and
 * neither may its immediate parent, so walk upwards until something resolves.
 */
export async function realpathOfNearestExistingAncestor(target) {
  let current = path.dirname(path.resolve(target));
  for (;;) {
    try {
      return await fs.realpath(current);
    } catch {
      const parent = path.dirname(current);
      // Reached the filesystem root without finding anything that exists.
      if (parent === current) return current;
      current = parent;
    }
  }
}

function isInside(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

/**
 * Throw when the storage state would be written inside the repository, whether
 * directly or through a symbolic link.
 *
 * Returns the real directory the state would land in, so callers can report it.
 */
export async function assertStorageStatePathOutsideRepo(statePath, repoRoot) {
  const resolvedStatePath = path.resolve(statePath);

  // The repository root itself may sit behind a symlink (a symlinked checkout,
  // or /tmp -> /private/tmp), so compare real paths on both sides.
  let realRepoRoot;
  try {
    realRepoRoot = await fs.realpath(repoRoot);
  } catch {
    realRepoRoot = path.resolve(repoRoot);
  }

  if (isInside(resolvedStatePath, path.resolve(repoRoot)) || isInside(resolvedStatePath, realRepoRoot)) {
    throw new StorageStatePathError(
      `BETA_STORAGE_STATE_PATH (${resolvedStatePath}) is inside the repository. ` +
        "Authenticated session material must be written outside the working tree.",
    );
  }

  const realParent = await realpathOfNearestExistingAncestor(resolvedStatePath);
  if (isInside(realParent, realRepoRoot)) {
    throw new StorageStatePathError(
      `BETA_STORAGE_STATE_PATH (${resolvedStatePath}) resolves through a symbolic link into the repository ` +
        `(${realParent}). Authenticated session material must be written outside the working tree.`,
    );
  }

  return realParent;
}
