// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { GitHub } from '@actions/github/lib/utils.js';
import { parseNeedsToSources } from '../common/needs_to_sources.js';
import { makeSourcesContext, SourceContext } from './sources_context.js';
import { plural } from '../common/utils.js';
import { truncateContext } from './truncate_context.js';
import { jsonTokens } from './tokens.js';

// Script entry point
export default function run(_github: InstanceType<typeof GitHub>): SourceContext[] {
    // Action inputs
    const needs                 =        core.getInput('needs',                 { required: true });
    const maxTokens             = Number(core.getInput('input_sources_tokens',  { required: true }));
    const guidanceFileTokens    = Number(core.getInput('guidance_file_tokens',  { required: true }));
    const promptTokens          = Number(core.getInput('prompt_tokens',         { required: true }));

    // Parse the needs input as JSON and select sources to be analysed
    const sources = parseNeedsToSources(needs);
    const analyseSources = sources.filter(({ status }) => status === 'success');
    core.info(`${analyseSources.length} of ${plural(sources.length, 'data source')} to be analysed`);
    core.debug(JSON.stringify(sources, null, 4));

    // Input context available for the data sources
    core.info(`Budget for data sources context: ${maxTokens} tokens`);

    // Convert data sources to the prompt context format
    const context = makeSourcesContext(analyseSources);

    // If necessary, trim the sources to fit within the max token limit
    const truncatedContext = truncateContext(context, maxTokens);

    // Determine the number of tokens used by the data sources context
    const truncatedContextTokens = jsonTokens(truncatedContext);
    core.info(`Final data sources context: ${truncatedContextTokens} tokens`);

    // Provide the updated token count as a discrete output and return the context
    core.setOutput('prompt_tokens', promptTokens + guidanceFileTokens + truncatedContextTokens);
    return truncatedContext;
}