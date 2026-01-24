// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { GitHub } from '@actions/github/lib/utils.js';
import { parseNeedsToSources } from '../common/needs_to_sources.js';
import { getSourcesContextChars, makeSourcesContext, SourceContext } from './sources_context.js';
import { plural } from '../common/utils.js';
import { truncateContext } from './truncate_context.js';

// GPT tokeniser: 1 token ≈ 4 prose characters or 3-3.5 for code/logs
const CHARS_PER_TOKEN = 3; // (assume worst case when truncating to fit)

// Script entry point
export default function run(_github: InstanceType<typeof GitHub>): SourceContext[] {
    // Action inputs
    const needs         = core.getInput('needs', { required: true });
    const maxTokens     = Number(process.env.MAX_TOKENS);
    const promptTokens  = Number(process.env.PROMPT_TOKENS);

    // Parse the needs input as JSON and select sources to be analysed
    const sources = parseNeedsToSources(needs);
    const analyseSources = sources.filter(({ status }) => status === 'success');
    core.info(`${analyseSources.length} of ${plural(sources.length, 'data source')} to be analysed`);
    core.debug(JSON.stringify(sources, null, 4));

    // Input context available for the data sources
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    core.info(`Budget for data sources context: ${maxChars} characters = ${maxTokens} tokens`);

    // Convert data sources to the prompt context format
    const context = makeSourcesContext(analyseSources);

    // If necessary, trim the sources to fit within the max token limit
    const truncatedContext = truncateContext(context, maxChars);

    // Determine the number of tokens used by the data sources context
    const contextChars = getSourcesContextChars(truncatedContext);
    const contextTokens = Math.ceil(contextChars / CHARS_PER_TOKEN);
    core.info(`Final data sources context: ${contextChars} characters = ${contextTokens} tokens`);

    // Provide the updated token count as a discrete output and return the context
    core.setOutput('prompt_tokens', promptTokens + contextTokens);
    return truncatedContext;
}