// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { Analysis } from './analysis_json.js';
import { ReportRow, ReportStatus } from './report.js';

// Mapping of status to emojis
const STATUS_EMOJI: Record<ReportStatus, string> = {
    'unavailable':          '⚠️',
    'directly relevant':    '🔴',
    'possibly relevant':    '🟡',
    'not relevant':         '🟢',
    'not applicable':       '👻' // (gets filtered out)
};

// Convert the report rows into Markdown suitable for an issue comment
export function makeComment(report: ReportRow[]): string {
    const lines = [
        // Table header
        '| Relevance | Data Source | Detail',
        '| :-------: | ----------- | ------',
        // Table body
        ...report.map(({ status, title, detail }) => {
            const icon = STATUS_EMOJI[status];
            return `| ${icon} | ${title} | ${detail} |`;
        })
    ];
    return lines.join('\n');
}

// Decide whether a comment should be posted based on the analysis
export function isCommentRelevant(report: ReportRow[], analysis: Analysis): boolean {
    const hasStatus = (...statuses: ReportStatus[]): boolean =>
        report.some(({ status }) => statuses.includes(status));

    // Strategy depends on the apparent issue category and statuses
    switch (analysis.issue_nature) {
    case 'bug report':      return 0 < report.length; // (even 'all good' is useful)
    case 'feature request': return hasStatus('unavailable', 'directly relevant');
    case 'other support':   return hasStatus('unavailable', 'directly relevant', 'possibly relevant');
    }
}