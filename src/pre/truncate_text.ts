// GitHub action
// Copyright © 2026 Alexander Thoukydides

// Marker for omitted text
const TRUNCATION_MARKER = '\n\n[…truncated…]\n\n';

// Instantiate segmenter for sentences and words
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
const wordSegmenter     = new Intl.Segmenter(undefined, { granularity: 'word' });

// Truncate text (try to use good break points, but meet target regardless)
export function truncateText(value: string, maxChars: number): string {
    if (value.length <= maxChars)               return value;
    if (maxChars < TRUNCATION_MARKER.length)    return '';

    // Partition the text with different granularity
    const textPartitions = [
        value.split(/(\n+)/),   // (lines)
        [...sentenceSegmenter.segment(value)].map(({ segment }) => segment),
        [...wordSegmenter    .segment(value)].map(({ segment }) => segment)
    ];

    // Search for a partition under the target length
    const choosePrefix = (partitions: string[][], maxChars: number): string[] => {
        const minChars = Math.floor(maxChars * 0.8);
        let prefix: string[] = [];
        for (const partition of partitions) {
            // Find longest length of this partition under the limit
            prefix = [];
            let length = 0;
            for (const segment of partition) {
                if (maxChars < length + segment.length) break;
                prefix.push(segment);
                length += segment.length;
            }
            if (minChars <= length) break;
        }
        return prefix;
    };
    const chooseSuffix = (partitions: string[][], maxChars: number): string[] =>
        choosePrefix(partitions.map(p => p.toReversed()), maxChars).toReversed();

    // Cut out the middle of the text to end up under the target
    const maxPrefixChars = Math.floor((maxChars - TRUNCATION_MARKER.length) / 2);
    const prefix = choosePrefix(textPartitions, maxPrefixChars).join('').trimEnd();
    const maxSuffixChars = Math.floor(maxChars - prefix.length - TRUNCATION_MARKER.length);
    const suffix = chooseSuffix(textPartitions, maxSuffixChars).join('').trimStart();
    return `${prefix}${TRUNCATION_MARKER}${suffix}`;
}