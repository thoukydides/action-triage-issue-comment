// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { Analysis } from './analysis_json.js';
import { ReportRow, ReportStatus } from './report.js';

// Maximum length for detail text in the table
const MAX_DETAIL_CHARS = 300;

// Mapping of status to emojis
const STATUS_EMOJI: Record<ReportStatus, string> = {
    'unavailable':          '⚠️',
    'relevant':             '🔴',
    'somewhat relevant':    '🟡',
    'not relevant':         '🟢'
};

// Convert the report rows into Markdown suitable for an issue comment
export function makeComment(report: ReportRow[]): string {
    const lines = [
        // Table header
        '| Status | Data Source | Detail',
        '| ------ | ----------- | ------',
        // Table body
        ...report.map(({ status, name, detail }) => {
            const icon = STATUS_EMOJI[status];
            return `| ${icon} | ${sanitiseTableCell(name)} | ${sanitiseTableCell(detail)} |`;
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
    case 'feature request': return hasStatus('unavailable', 'relevant');
    case 'other support':   return hasStatus('unavailable', 'relevant', 'somewhat relevant');
    }
}

// Sanitise text for safe inclusion in a Markdown table cell
function sanitiseTableCell(text: string): string {
    text = text
        .replace(/\s+/g, ' ').trim()    // Collapse whitespace
        .replace(/\|/g, '\\|');         // Escape pipe characters

    // Truncate if excessively long (at a word boundary if possible)
    if (MAX_DETAIL_CHARS < text.length) {
        let breakLength = text.lastIndexOf(' ', MAX_DETAIL_CHARS - 1);
        if (breakLength === -1) breakLength = MAX_DETAIL_CHARS - 1;
        text = text.substring(0, breakLength) + '…';
    }
    return text;
}