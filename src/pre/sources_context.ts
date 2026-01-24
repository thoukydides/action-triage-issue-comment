// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { DataSource } from '../common/needs_to_sources.js';

// Data sources prepared for use in the AI prompt
export type SourceContextValue = string | Record<string, unknown> | unknown[] | number | boolean | null;
export interface SourceContext {
    name:           string;
    instruction?:   string;
    value:          SourceContextValue; // (allow native JSON-like values)
}

// Convert data sources to the prompt context format
export function makeSourcesContext(sources: DataSource[]): SourceContext[] {
    return sources.map(({ name, value, prompt }) =>
        ({ name, value: parseIfJson(value), instruction: prompt }));
}

// Size of the prompt context
export function getSourcesContextChars(context: SourceContext[]): number {
    return JSON.stringify(context).length;
}

// Size of a single prompt value
export function getSourceContextValueChars(value: SourceContextValue): number {
    return JSON.stringify(value).length;
}

// If value is valid JSON then parse it, otherwise return the original string
function parseIfJson(text: string): SourceContextValue {
    try {
        return JSON.parse(text) as SourceContextValue;
    } catch {
        return text;
    }
}