// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { hasProperties, isObject, isString, isStringEnum } from '../common/utils.js';

// The expected structure of the analysis JSON produced by the AI model
const ANALYSIS_NATURE           = ['bug report', 'feature request', 'other support'] as const;
const ANALYSIS_RELEVANCE        = ['relevant', 'somewhat relevant', 'not relevant'] as const;
export type AnalysisNature      = typeof ANALYSIS_NATURE[number];
export type AnalysisRelevance   = typeof ANALYSIS_RELEVANCE[number];
export type AnalysisVersion     = `v${number}.${number}.${number}` | '';
const ANALYSIS_VERSION_PATTERN  = /^(v\d+\.\d+\.\d+|)$/;
export interface AnalysisDataSource {
    name:           string;
    relevance:      AnalysisRelevance;
    explanation:    string;
}
export interface Analysis {
    issue_nature:       AnalysisNature;
    release_version:    AnalysisVersion;
    data_sources:       AnalysisDataSource[];
}

// Parse the AI result and rigorously validate its structure
export function parseAnalysisJSON(analysisJson: string, sourceNames: string[]): Analysis {
    // Parse the JSON
    let analysis: unknown;
    try {
        analysis = JSON.parse(analysisJson);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse analysis JSON: ${message}`);
    }

    // Check the root object
    const ROOT_PROPERTIES = ['issue_nature', 'release_version', 'data_sources'] as const;
    assertIs(analysis,          isObject,                               'not a valid object');
    assertIs(analysis,          o => hasProperties(o, ROOT_PROPERTIES), 'missing required properties');
    const { issue_nature, release_version, data_sources } = analysis;
    assertIs(issue_nature,      e => isStringEnum(e, ANALYSIS_NATURE),  'issue_nature is not a valid enum');
    assertIs(release_version,   isString,                               'release_version is not a string');
    if (!ANALYSIS_VERSION_PATTERN.test(release_version)) {
        throw new Error('Analysis JSON release_version is not in the required format');
    }
    assertIs(data_sources,      Array.isArray,                          'data_sources is not an array');

    // Check the data_sources array entries
    const analysisSourceNames = data_sources.map((data_source, index) => {
        const element = `data_sources[${index}]`;
        const SOURCE_PROPERTIES = ['name', 'relevance', 'explanation'] as const;
        assertIs(data_source,   isObject,                                   `${element} is not a valid object`);
        assertIs(data_source,   o => hasProperties(o, SOURCE_PROPERTIES),   `${element} missing required properties`);
        const { name, relevance, explanation } = data_source;
        assertIs(name,          isString,                                   `${element}.name is not a string`);
        assertIs(relevance,     e => isStringEnum(e, ANALYSIS_RELEVANCE),   `${element}.relevance is not a valid enum`);
        assertIs(explanation,   isString,                                   `${element}.explanation is not a string`);
        return name;
    });
    if (sourceNames.length !== analysisSourceNames.length
        || !sourceNames.every(name => analysisSourceNames.includes(name))) {
        throw new Error('Analysis JSON data_sources does not match the expected sources');
    }

    // Return the validated analysis object
    return analysis as Analysis;
}

// Generic assertion for AI analysis validation
function assertIs<T extends V, V>(value: V, test: (value: V) => value is T, msg: string): asserts value is T {
    if (!test(value)) throw new Error(`Analysis JSON validation failed: ${msg}`);
}