// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { getSourceContextValueChars, getSourcesContextChars, SourceContext, SourceContextValue } from './sources_context.js';
import { plural } from '../common/utils.js';

// Truncate the issue to fit within the available input context
export function truncateContext(context: SourceContext[], maxChars: number): SourceContext[] {
    // Context used by the current sources context
    let availableChars = maxChars - getSourcesContextChars(context.map(s => ({...s, value: '' })));
    const sourcesChars = context.map(({ value }) => getSourceContextValueChars(value));

    // Truncate each source to fit within the available space
    const truncatedContext = context.map(({ name, value, ...rest }) => {
        // Determine the budget for this data source
        const maxValueChars = selectMaxChars(sourcesChars, availableChars);
        core.debug(JSON.stringify({ name, availableChars, maxValueChars, sourcesChars }));

        // Truncate this data source's value to the selected size
        const truncatedValue = truncateJson(value, maxValueChars);
        const usedChars = getSourceContextValueChars(truncatedValue);
        if (truncatedValue !== value) {
            core.warning(`Truncated data source ${name}`
                + ` from ${sourcesChars[0]} to ${plural(usedChars, 'character')}`
                + ` (limit ${plural(maxChars, 'character')})`);
        }

        // Update the character counts and return the truncated value
        availableChars -= usedChars;
        sourcesChars.shift();
        return { name, value: truncatedValue, ...rest };
    });
    return truncatedContext;
}

// Select the maximum number of characters to allocate to each data source
function selectMaxChars(sourceChars: number[], availableChars: number): number {
    // Lower and upper bounds on the maximum size for all remaining sources
    let minChars = Math.floor(availableChars / sourceChars.length);
    let maxChars = Math.max(...sourceChars, minChars);

    // Binary search to find the highest limit within the available size
    while (minChars < maxChars) {
        const testChars = Math.ceil((minChars + maxChars) / 2);
        const totalChars = sourceChars.reduce((total, chars) => total + Math.min(chars, testChars), 0);
        if (totalChars <= availableChars)   minChars = testChars;
        else                                maxChars = testChars - 1;
    }
    return maxChars;
}

// Truncate an arbitrary value type to the specified maximum length
function truncateJson(value: SourceContextValue, maxChars: number): SourceContextValue {
    // If already small enough then no change needed
    if (getSourceContextValueChars(value) < maxChars) return value;

    // If the value is an array then try removing elements to satisfy the target
    if (Array.isArray(value)) {
        const truncatedValue = truncateArray(value, maxChars);
        if (getSourceContextValueChars(truncatedValue) < maxChars) return truncatedValue;
    }

    // If still too large then convert to JSON and truncate as arbitrary text
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return truncateText(json, maxChars);
}

// Truncate an array to the specified maximum length
function truncateArray(value: unknown[], maxChars: number): unknown[] {
    // Create an array with middle elements omitted
    const omitElements = (omitCount: number): unknown[] => {
        const headCount = Math.ceil((value.length - omitCount) / 2);
        const tailCount = value.length - omitCount - headCount;
        const marker = { __truncated__: `${omitCount} of ${plural(value.length, 'element')} omitted` };
        return [...value.slice(0, headCount), marker, ...value.slice(-tailCount)];
    };

    // Lower and upper bounds on the number of elements to omit
    let minOmitCount = 0;
    let maxOmitCount = value.length - 1;

    // Binary search to find the highest omission count within the available size
    while (minOmitCount < maxOmitCount) {
        const testOmitCount = Math.floor((minOmitCount + maxOmitCount) / 2);
        const truncatedChars = getSourceContextValueChars(omitElements(testOmitCount));
        if (truncatedChars <= maxChars) maxOmitCount = testOmitCount;
        else                            minOmitCount = testOmitCount + 1;
    }
    return omitElements(minOmitCount);
}

// Truncate text (try to use good break points, but meet target regardless)
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
const wordSegmenter     = new Intl.Segmenter(undefined, { granularity: 'word' });
const TRUNCATION_MARKER = '\n\n[…truncated…]\n\n';
export function truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars)               return value;
    if (maxChars < TRUNCATION_MARKER.length)    return '';

    // Partition the text with different granularity
    const textPartitions = [
        value.split(/(\n+)/),   // (lines)
        [...sentenceSegmenter.segment(value)].map(({ segment }) => segment),
        [...wordSegmenter    .segment(value)].map(({ segment }) => segment)
    ];

    // Search for a partition under the target length
    const choosePrefix = (partitions: string[][], maxChars: number): string[] => {
        const minChars = Math.floor(maxChars * 0.8);
        let prefix: string[] = [];
        for (const partition of partitions) {
            // Find longest length of this partition under the limit
            prefix = [];
            let length = 0;
            for (const segment of partition) {
                if (maxChars < length + segment.length) break;
                prefix.push(segment);
                length += segment.length;
            }
            if (minChars <= length) break;
        }
        return prefix;
    };
    const chooseSuffix = (partitions: string[][], maxChars: number): string[] =>
        choosePrefix(partitions.map(p => p.toReversed()), maxChars).toReversed();

    // Cut out the middle of the text to end up under the target
    const maxPrefixChars = Math.floor((maxChars - TRUNCATION_MARKER.length) / 2);
    const prefix = choosePrefix(textPartitions, maxPrefixChars).join('').trimEnd();
    const maxSuffixChars = Math.floor(maxChars - prefix.length - TRUNCATION_MARKER.length);
    const suffix = chooseSuffix(textPartitions, maxSuffixChars).join('').trimStart();
    return `${prefix}${TRUNCATION_MARKER}${suffix}`;
}
