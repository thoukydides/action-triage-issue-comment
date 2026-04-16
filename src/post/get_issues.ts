// GitHub action
// Copyright © 2026 Alexander Thoukydides

import { GitHub, context } from '@actions/github/lib/utils';
import * as core from '@actions/core';
import { plural } from '../common/utils.js';

// A simplified representation of an issue
export interface Issue {
    number:                 number;
    title:                  string;
    created_at:             string;
    closed:                 boolean;
    labelled_as_invalid:    boolean;
}

// Retrieve previous issues created by the same user
export async function getOtherIssuesByUser(github: InstanceType<typeof GitHub>, issue_number: number): Promise<Issue[]> {
    // Get the issue details to identify the creator
    const { owner, repo } = context.repo;
    const issue = (await github.rest.issues.get({ owner, repo, issue_number })).data;
    const creator = issue.user?.login;
    core.info(`Retrieved issue ${issue_number} created by ${creator}`);
    core.debug(`REST API Issue:\n${JSON.stringify(issue, null, 4)}`);
    if (!creator) {
        core.warning(`Issue #${issue_number} has no creator information; skipping search for previous issues`);
        return [];
    }

    // Get other issues created by the same user during the last year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const issues = await github.paginate(github.rest.issues.listForRepo, {
        owner, repo, creator, state: 'all', sort: 'created', direction: 'desc', since: oneYearAgo.toISOString()
    });
    core.info(`Retrieved ${plural(issues.length, 'issue')} created by ${creator} in the last year`);
    core.debug(`REST API Issues:\n${JSON.stringify(issues, null, 4)}`);

    // Exclude the current issue and pull requests
    const filteredIssues = issues.filter(i => i.number !== issue_number && !i.pull_request);

    // Convert the issue details to a simpler format
    return filteredIssues.map(({ number, title, created_at, state, labels }) => ({
        number,
        title,
        created_at,
        closed:     state === 'closed',
        labelled_as_invalid: labels.some(l => typeof l === 'string' ? l === 'invalid' : l.name === 'invalid')
    }));
}