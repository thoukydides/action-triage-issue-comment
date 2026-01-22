// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { GitHub } from '@actions/github/lib/utils.js';
import { parseDataSourcesJSON } from '../common/sources_yaml.js';
import { parseAnalysisJSON } from './analysis_json.js';
import { plural } from '../common/utils.js';
import { makeDataSourcesReport, makeVersionReport } from './report.js';
import { isCommentRelevant, makeComment } from './comment.js';

// Script entry point
export default async function run(github: InstanceType<typeof GitHub>): Promise<string> {
    // Action inputs
    const sourcesJSON   = process.env.SOURCES   ?? '';
    const analysisJSON  = process.env.ANALYSIS  ?? '';

    // Parse the input sources JSON and analysis JSON
    const sources   = parseDataSourcesJSON(sourcesJSON);
    const analysedSourceNames = sources.filter(({ status }) => status === 'success').map(({ name }) => name);
    const analysis  = parseAnalysisJSON(analysisJSON, analysedSourceNames);
    core.info(`${analysis.data_sources.length} of ${plural(sources.length, 'data source')} analysed`);
    core.debug(JSON.stringify(analysis, null, 4));

    // Construct a report from the data sources and analysis
    const report = makeDataSourcesReport(sources, analysis);
    const versionReport = await makeVersionReport(github, analysis);
    if (versionReport) report.unshift(versionReport);

    // Prepare the comment and decide whether it should be posted
    const comment = makeComment(report);
    core.info(`Comment:\n${comment}`);
    const relevant = isCommentRelevant(report, analysis);
    core.info(`Data sources ${relevant ? 'are': 'are not'} relevant to the issue`);

    // Provide the decision as a discrete output and return the comment
    core.setOutput('relevant', relevant);
    return comment;
}