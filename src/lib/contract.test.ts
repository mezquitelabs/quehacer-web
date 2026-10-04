import { describe, expect, it } from 'vitest';
import { assertSupportedSchema, DataContractError, SUPPORTED_SCHEMA_VERSION } from './contract';

const meta = (extra: Record<string, unknown>) => ({ generated_at: '2026-10-04T16:00:00+00:00', cities: {}, ...extra });

describe('data contract version', () => {
  it('supports version 1', () => {
    expect(SUPPORTED_SCHEMA_VERSION).toBe(1);
    expect(() => assertSupportedSchema(meta({ schema_version: 1 }))).not.toThrow();
  });
  it('ignores fields it does not know (additive changes keep the version)', () => {
    expect(() => assertSupportedSchema(meta({ schema_version: 1, something_new: { a: 1 } }))).not.toThrow();
  });
  it('rejects a newer version with a message that says what to do', () => {
    const run = () => assertSupportedSchema(meta({ schema_version: 2 }));
    expect(run).toThrow(DataContractError);
    expect(run).toThrow(/schema_version 2 but this site supports 1/);
    expect(run).toThrow(/docs\/data-contract\.md/);
  });
  it('rejects an older version too', () => {
    expect(() => assertSupportedSchema(meta({ schema_version: 0 }))).toThrow(/schema_version 0 but this site supports 1/);
  });
  it('rejects a meta.json without schema_version', () => {
    const run = () => assertSupportedSchema(meta({}));
    expect(run).toThrow(DataContractError);
    expect(run).toThrow(/no "schema_version"/);
  });
  it('rejects a non-integer version, however it is spelled', () => {
    for (const bad of ['1', 1.5, null, true, [1]]) {
      expect(() => assertSupportedSchema(meta({ schema_version: bad }))).toThrow(/must be an integer/);
    }
  });
  it('rejects something that is not an object', () => {
    for (const bad of [null, 'text', 42, undefined]) expect(() => assertSupportedSchema(bad)).toThrow(/not a JSON object/);
  });
});
