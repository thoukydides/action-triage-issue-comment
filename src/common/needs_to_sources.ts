// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { hasProperties, isObject, isString, isStringEnum } from './utils.js';

// Data source details derived from the GitHub Actions needs context
const DATA_SOURCE_STATUS = ['success', 'failure', 'skipped'] as const;
export type DataSourceStatus = typeof DATA_SOURCE_STATUS[number];
export interface DataSource {
    status:     DataSourceStatus;
    name:       string;
    name_md?:   string;
    url?:       string;
    value:      string;
    prompt?:    string;
    guidance?:  string;
}

// GitHub Actions needs context
interface NeedsContextJob {
    result:     DataSourceStatus;
    outputs?:   Record<string, string | undefined>;
}
type NeedsContext = Record<string, NeedsContextJob>;

// Parse the needs JSON and convert it to the data sources structure
export function parseNeedsToSources(needsJSON: string): DataSource[] {
    // Parse the JSON
    const needs = parseNeeds(needsJSON);

    // Convert to the internal data sources representation
    return Object.entries(needs).map(([job, { result, outputs }]) => ({
        status:     result,
        name:       outputs?.name       ?? job,
        name_md:    outputs?.name_md,
        url:        outputs?.url,
        value:      outputs?.value      ?? '',
        prompt:     outputs?.prompt,
        guidance:   outputs?.guidance
    }));
}

// Parse and validate a GitHub Needs object
function parseNeeds(needsJSON: string): NeedsContext {
    // Parse the JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(needsJSON);
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`Failed to parse data sources "needs" JSON: ${message}`, { cause });
    }

    // Check that an object was provided
    assertIs(parsed, isObject, 'not an object');

    // Check the object properties (the jobs)
    for (const [job, info] of Object.entries(parsed)) {
        const element = `needs.${job}`;
        assertIs(info,          isObject,                                   `${element} is not a valid object`);
        assertIs(info,          o => hasProperties(o, ['result']),          `${element}.result property is missing`);
        assertIs(info.result,   e => isStringEnum(e, DATA_SOURCE_STATUS),   `${element}.status is not a valid enum`);
        if (hasProperties(info, ['outputs'])) {
            const outputs = info.outputs;
            assertIs(outputs,   isObject,   `${element}.outputs is not an object`);
            for (const [key, value] of Object.entries(outputs)) {
                assertIs(value, isString, `${element}.outputs.${key} is not a string`);
            }
        }
    }

    // Return the validated needs context
    return parsed as NeedsContext;
}

// Generic assertion for AI analysis validation
function assertIs<T extends V, V>(value: V, test: (value: V) => value is T, msg: string): asserts value is T {
    if (!test(value)) throw new Error(`Data sources "needs" JSON validation failed: ${msg}`);
}