// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { Tiktoken } from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';

// Generate value and client context based on an integral parameter
// (size generally increases with parameter value)
export type TokenMaker<T, U> = (param: number) => { value: T, context: U };

// Result of a token optimisation
export interface TokenFitResult<T, U> {
    param:      number;     // The optimised integral parameter
    value:      T;          // maker(param).value
    context:    U;          // maker(param).context
    tokens:     number;     // The number of tokens in value
    done:       boolean;    // Was the token limit satisfied
}

// Initialise the encoder once
const encoder = new Tiktoken(ranks);

// Token count for a string
export function textTokens(text: string): number {
    return encoder.encode(text).length;
}

// Token count for JSON encoding of an object
export function jsonTokens(value: unknown): number {
    const jsonString = JSON.stringify(value);
    return textTokens(jsonString);
}

// Find the largest integral parameter that fits within a token count limit
// (might not be optimal if size changes non-monotonically)
export function fitTokens<T, U>(
    maker:      TokenMaker<T, U>,
    maxTokens:  number,
    minParam:   number,
    maxParam:   number
): TokenFitResult<T, U> {
    // Perform a binary search to find the largest parameter that fits
    while (minParam < maxParam) {
        const testParam = Math.ceil((minParam + maxParam) / 2);
        const { done } = getTokensResult(maker, maxTokens, testParam);
        if (done)   minParam = testParam;
        else        maxParam = testParam - 1;
    }

    // Return the best fit
    return getTokensResult(maker, maxTokens, maxParam);
}

// Apply a maker method and assess the resulting token count
export function getTokensResult<T, U>(
    maker:      TokenMaker<T, U>,
    maxTokens:  number,
    param = 0
): TokenFitResult<T, U> {
    const { value, context } = maker(param);
    const tokens = jsonTokens(value);
    const done   = tokens <= maxTokens;
    return { param, value, context, tokens, done };
}