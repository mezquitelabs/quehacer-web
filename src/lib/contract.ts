import type { Meta } from './types';

/** The version of the data files (src/data) this site understands. See docs/data-contract.md. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export class DataContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataContractError';
  }
}

/**
 * Fail the build, with a message that says what to do, when meta.json was written for another version of the contract.
 * Optional fields may be added without bumping the version; renaming, removing or re-typing a field bumps it.
 */
export function assertSupportedSchema(meta: unknown): asserts meta is Meta {
  const hint = 'See docs/data-contract.md. Re-export the data with a crawler that writes this version, or update this site.';
  if (typeof meta !== 'object' || meta === null) {
    throw new DataContractError(`src/data/meta.json is not a JSON object. ${hint}`);
  }
  const version = (meta as { schema_version?: unknown }).schema_version;
  if (version === undefined) {
    throw new DataContractError(
      `src/data/meta.json has no "schema_version", so it was written by an older exporter or by hand; this site requires schema_version ${SUPPORTED_SCHEMA_VERSION}. ${hint}`,
    );
  }
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new DataContractError(`src/data/meta.json "schema_version" must be an integer, got ${JSON.stringify(version)}. ${hint}`);
  }
  if (version !== SUPPORTED_SCHEMA_VERSION) {
    throw new DataContractError(
      `Unsupported data contract: src/data/meta.json has schema_version ${version} but this site supports ${SUPPORTED_SCHEMA_VERSION}. ${hint}`,
    );
  }
}
