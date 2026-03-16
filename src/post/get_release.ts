// GitHub action
// Copyright © 2026 Alexander Thoukydides

import * as core from '@actions/core';
import { context } from '@actions/github';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { GitHub } from '@actions/github/lib/utils';
import { isValidDate } from '../common/utils.js';

// GitHub REST API types
type RestReleaseResponse = RestEndpointMethodTypes['repos']['getLatestRelease' | 'getReleaseByTag']['response'];

// Simplified release details
export interface Release {
    version:        string;
    url:            string;
    published_at:   Date;
}

// Retrieve details of the latest release
export function getLatestRelease(github: InstanceType<typeof GitHub>): Promise<Release | undefined> {
    const op = () => github.rest.repos.getLatestRelease(context.repo);
    return getReleaseSimplified('latest release', op);
}

// Retrieve details of the specified release
export function getRelease(github: InstanceType<typeof GitHub>, version: string): Promise<Release | undefined> {
    const op = () => github.rest.repos.getReleaseByTag({ ...context.repo, tag: version });
    return getReleaseSimplified(`release ${version}`, op);
}

// Wrapper to retrieve a release and convert the result to a simpler format
async function getReleaseSimplified(description: string, op: () => Promise<RestReleaseResponse>): Promise<Release | undefined> {
    try {
        // Retrieve the release details from the GitHub API
        const result = (await op()).data;
        const { tag_name, html_url, published_at } = result;
        core.info(`Retrieved ${description}: ${tag_name} (${published_at})`);
        core.debug(`REST API Release:\n${JSON.stringify(result, null, 4)}`);

        // Convert the release details to a simplified format
        const date = published_at ? new Date(published_at) : null;
        if (!isValidDate(date)) throw new Error(`Invalid published_at date: ${published_at}`);
        return {
            version:        tag_name,
            url:            html_url,
            published_at:   date
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to retrieve ${description}: ${message}`);
    }
}