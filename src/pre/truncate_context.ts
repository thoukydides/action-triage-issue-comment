// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { SourceContext, SourceContextValue } from './sources_context.js';
import { plural } from '../common/utils.js';
import { fitTokens, jsonTokens, TokenFitResult } from './tokens.js';
import { truncateText } from './truncate_text.js';

// Truncate the issue to fit within the available input context
export function truncateContext(context: SourceContext[], maxTokens: number): SourceContext[] {
    // Context used by the current sources context
    let availableTokens = maxTokens - jsonTokens(context.map(s => ({...s, value: '' })));
    const sourcesTokens = context.map(({ value }) => jsonTokens(value));

    // Truncate each source to fit within the available space
    const truncatedContext = context.map(({ name, value, ...rest }) => {
        // Determine the budget for this data source
        const maxValueTokens = selectMaxTokens(sourcesTokens, availableTokens);
        core.debug(JSON.stringify({ name, availableTokens, maxValueTokens, sourcesTokens }));

        // Truncate this data source's value to the selected size
        const truncated = truncateJson(value, maxValueTokens);
        if (truncated.value !== value) {
            core.warning(`Truncated data source ${name}`
                + ` from ${sourcesTokens[0]} to ${plural(truncated.tokens, 'token')}`
                + ` (limit ${plural(maxTokens, 'token')})`);
        }

        // Update the token counts and return the truncated value
        availableTokens -= truncated.tokens;
        sourcesTokens.shift();
        return { name, value: truncated.value, ...rest };
    });
    return truncatedContext;
}

// Select the maximum number of tokens to allocate to each data source
function selectMaxTokens(sourceTokens: number[], availableTokens: number): number {
    // Lower and upper bounds on the maximum size for all remaining sources
    let minTokens = Math.floor(availableTokens / sourceTokens.length);
    let maxTokens = Math.max(...sourceTokens, minTokens);

    // Binary search to find the highest limit within the available size
    while (minTokens < maxTokens) {
        const testTokens = Math.ceil((minTokens + maxTokens) / 2);
        const totalTokens = sourceTokens.reduce((total, chars) => total + Math.min(chars, testTokens), 0);
        if (totalTokens <= availableTokens) minTokens = testTokens;
        else                                maxTokens = testTokens - 1;
    }
    return maxTokens;
}

// Truncate an arbitrary value type to the specified maximum length
function truncateJson(value: SourceContextValue, maxTokens: number): TokenFitResult<SourceContextValue, null> {
    // If the value is an array then try removing elements to satisfy the target
    if (Array.isArray(value)) {
        const result = truncateArray(value, maxTokens);
        if (result.done) return result;
    }

    // If still too large then convert to JSON and truncate as arbitrary text
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return fitText(json, maxTokens);
}

// Truncate an array to the specified maximum length
function truncateArray(value: unknown[], maxTokens: number): TokenFitResult<unknown[], null> {
    // The parameter is the number of elements to keep
    const maker = (param: number) => {
        const headCount = Math.ceil(value.length / 2);
        const tailCount = param - headCount;
        const omitCount = value.length - param;
        const marker = { __truncated__: `${omitCount} of ${plural(value.length, 'element')} omitted` };
        return { value: [...value.slice(0, headCount), marker, ...value.slice(-tailCount)], context: null };
    };

    // Select the parameter value that best fits the token budget
    return fitTokens(maker, maxTokens, 0, value.length);
}

// Truncate text (try to use good break points, but meet target regardless)
export function fitText(value: string, maxTokens: number): TokenFitResult<string, null> {
    // The parameter is the maximum number of characters to keep
    const maker = (param: number) => ({ value: truncateText(value, param), context: null });

    // Select the parameter value that best fits the token budget
    return fitTokens(maker, maxTokens, 0, value.length);
}