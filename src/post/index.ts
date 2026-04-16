// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { GitHub } from '@actions/github/lib/utils';
import { parseNeedsToSources } from '../common/needs_to_sources.js';
import { parseAnalysisJSON } from './analysis_json.js';
import { plural } from '../common/utils.js';
import { makeDataSourcesReport, makeVersionReport } from './report.js';
import { isCommentRelevant, makeComment } from './comment.js';
import { getOtherIssuesByUser } from './get_issues.js';

// Script entry point
export default async function run(github: InstanceType<typeof GitHub>): Promise<string> {
    // Action inputs
    const needs         =        core.getInput('needs',         { required: true });
    const issue_number  = Number(core.getInput('issue_number',  { required: true }));
    const analysisJSON  = process.env.ANALYSIS  ?? '';

    // Parse the input needs JSON and analysis JSON
    const sources = parseNeedsToSources(needs);
    const analysedSourceNames = sources.filter(({ status }) => status === 'success').map(({ name }) => name);
    const analysis = parseAnalysisJSON(analysisJSON, analysedSourceNames);
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

    // Retrieve any other issues created by the same user during the last year
    const otherIssues = await getOtherIssuesByUser(github, issue_number);
    core.info(`User has created ${plural(otherIssues.length, 'other issue')} in the last year`);

    // Provide the decision as a discrete output, returning comment and issues
    core.setOutput('relevant',      relevant);
    core.setOutput('other_issues',  otherIssues);
    return comment;
}