// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitHub } from '@actions/github/lib/utils.js';
import { assertIsDefined } from '../common/utils.js';
import { Analysis, AnalysisRelevance } from './analysis_json.js';
import { getLatestRelease, getRelease } from './get_release.js';
import { DataSource } from '../common/sources_yaml.js';

// Details for a row of the report table
export type ReportStatus = 'unavailable' | AnalysisRelevance;
export interface ReportRow {
    status: ReportStatus;
    name:   string;
    detail: string;
}

// Convert the data sources and analysis into comment rows
export function makeDataSourcesReport(sources: DataSource[], analysis: Analysis): ReportRow[] {
    const report: ReportRow[] = [];
    for (const { name, status } of sources) {
        switch (status) {
        case 'success': {
            const sourceAnalysis = analysis.data_sources.find(source => source.name === name);
            assertIsDefined(sourceAnalysis);
            const { relevance, explanation } = sourceAnalysis;
            report.push({ status: relevance, name, detail: explanation });
            break;
        }
        case 'failure':
            report.push({ status: 'unavailable', name, detail: 'Not available *(check workflow run for details)*' });
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
    return latestRelease.version === issueRelease.version ? {
        status: 'not relevant',
        name:   'Release version',
        detail: `Issue references the latest release **${latestRelease.version}**`
    } : {
        status: 'somewhat relevant',
        name:   'Release version',
        detail: `Issue references release **${issueRelease.version}**,`
                + ` but **${latestRelease.version}** was released ${latestPublished}`
    };
}

// Pretty format a date and time
export function formatDateTime(date: Date): string {
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