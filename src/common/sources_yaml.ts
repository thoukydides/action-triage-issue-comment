// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as yaml from 'js-yaml';
import { hasProperties, isObject, isString, isStringEnum } from './utils.js';

// The expected structure of the data sources YAML input
const DATA_SOURCE_STATUS = ['success', 'failure', 'skipped'] as const;
export type DataSourceStatus = typeof DATA_SOURCE_STATUS[number];
export interface DataSource {
    name:       string;
    status:     DataSourceStatus; // (defaults to 'success' if not specified)
    value:      string;
    prompt?:    string;
}

// Parse the data sources from YAML and rigorously validate its structure
export function parseDataSourcesYAML(sourcesYaml: string): DataSource[] {
    // Parse the YAML
    let parsed: unknown;
    try {
        parsed = yaml.load(sourcesYaml);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse data sources YAML: ${message}`);
    }

    // Check that an array was provided
    assertIs(parsed, Array.isArray, 'not an array');

    // Check the array entries
    const data_sources = parsed.map((data_source, index) => {
        const element = `data_sources[${index}]`;
        const SOURCE_PROPERTIES = ['name', 'value'] as const; // (status is optional)
        assertIs(data_source,   isObject,                                   `${element} is not a valid object`);
        assertIs(data_source,   o => hasProperties(o, SOURCE_PROPERTIES),   `${element} missing required properties`);
        const { name, value } = data_source;
        assertIs(name,          isString,                                   `${element}.name is not a string`);
        assertIs(value,         isString,                                   `${element}.value is not a string`);
        if ('status' in data_source) {
            assertIs(data_source.status, e => isStringEnum(e, DATA_SOURCE_STATUS), `${element}.status is not a valid enum`);
        }
        return { status: 'success', ...data_source } as DataSource;
    });

    // Return the validated data sources
    return data_sources;
}

// Parse the data sources from JSON (assumed already validated)
export function parseDataSourcesJSON(sources: string): DataSource[] {
    return JSON.parse(sources) as DataSource[];
}

// Generic assertion for AI analysis validation
function assertIs<T extends V, V>(value: V, test: (value: V) => value is T, msg: string): asserts value is T {
    if (!test(value)) throw new Error(`Data sources YAML validation failed: ${msg}`);
}