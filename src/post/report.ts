// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { context, GitHub } from '@actions/github/lib/utils';
import { assertIsDefined } from '../common/utils.js';
import { Analysis, AnalysisRelevance } from './analysis_json.js';
import { getLatestRelease, getRelease } from './get_release.js';
import { DataSource } from '../common/needs_to_sources.js';

// Maximum length for detail text in the table
const MAX_DETAIL_CHARS = 300;

// Details for a row of the report table
export type ReportStatus = 'unavailable' | AnalysisRelevance;
export interface ReportRow {
    status: ReportStatus;
    title:  string;
    detail: string;
}

// Convert the data sources and analysis into comment rows
export function makeDataSourcesReport(sources: DataSource[], analysis: Analysis): ReportRow[] {
    const report: ReportRow[] = [];
    for (const { name, name_md, url, status } of sources) {
        const title = name_md?.trim() ? name_md : url?.trim() ? `[${name}](${url})` : name;
        switch (status) {
        case 'success': {
            const sourceAnalysis = analysis.data_sources.find(source => source.name === name);
            assertIsDefined(sourceAnalysis);
            const { relevance, explanation } = sourceAnalysis;
            if (relevance !== 'not applicable') {
                report.push({ status: relevance, title, detail: sanitiseText(explanation) });
            }
            break;
        }
        case 'failure':
            report.push({ status: 'unavailable', title, detail: `Not available (see ${getWorkflowLink()} for details)` });
            break;
        case 'skipped':
            // Exclude skipped data sources from the comment
            break;
        }
    }
    return report;
}

// Create a report row for the version, if identified
export async function makeVersionReport(github: InstanceType<typeof GitHub>, analysis: Analysis): Promise<ReportRow | undefined> {
    if (!analysis.release_version) return;

    // Retrieve details of the latest and referenced releases
    const latestRelease = await getLatestRelease(github);
    const issueRelease  = await getRelease(github, analysis.release_version);
    if (!latestRelease || !issueRelease) return;

    // Report depends on whether the issue referenced the latest release
    const latestPublished = formatDateTime(latestRelease.published_at);
    const latestReleaseLink = `[${latestRelease.version}](${latestRelease.url})`;
    return latestRelease.version === issueRelease.version ? {
        status: 'not relevant',
        title:   'Release version',
        detail: `Issue references the latest release ${latestReleaseLink}`
    } : {
        status: 'possibly relevant',
        title:   'Release version',
        detail: `Issue references release **${issueRelease.version}**,`
                + ` but **${latestReleaseLink}** was released ${latestPublished}`
    };
}

// Construct a Markdown link to this workflow run
function getWorkflowLink(): string {
    const { serverUrl, workflow, runId } = context;
    const { owner, repo } = context.repo;
    const workflow_url = `${serverUrl}/${owner}/${repo}/actions/runs/${runId}`;
    return `[${workflow} #${runId}](${workflow_url})`;
}

// Pretty format a date and time
function formatDateTime(date: Date): string {
    return date.toLocaleString('en-GB', {
        year:   'numeric',
        month:  'long',
        day:    'numeric',
        weekday:'long',
        hour:   'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Sanitise text for safe inclusion in a Markdown table cell
function sanitiseText(text: string): string {
    const [summary, detail] = breakText(text, MAX_DETAIL_CHARS);
    return detail.length === 0
        ? escapeMarkdown(summary)
        : `<details><summary>${escapeMarkdown(summary)}…</summary>${escapeMarkdown(detail)}</details>`;
}

// Collapse whitespace and escape special Markdown characters
function escapeMarkdown(text: string): string {
    return text
        .replace(/\s+/g, ' ').trim()
        .replace(/[\\`*_{}<>[\]()#+\-.!|]/g, '\\$&');
}

// Split excessively long text (trying to use a good break point)
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
const wordSegmenter     = new Intl.Segmenter(undefined, { granularity: 'word' });
function breakText(text: string, maxChars: number): [string, string] {
    if (text.length <= maxChars) return [text, ''];

    // Try to break at a clean boundary
    let breakPoint = maxChars;
    for (const segmenter of [wordSegmenter, sentenceSegmenter]) {
        const segments = [...segmenter.segment(text)];
        const breakAfter = segments.findLast(({ index, segment, isWordLike }) =>
            index + segment.length <= maxChars && isWordLike !== false);
        if (breakAfter) breakPoint = breakAfter.index + breakAfter.segment.length;
    }

    // Split the text at the selected position
    return [
        text.substring(0, breakPoint).trimEnd(),
        text.substring(breakPoint).trimStart()
    ];
}