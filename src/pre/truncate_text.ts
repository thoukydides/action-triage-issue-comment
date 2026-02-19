// GitHub action
// Copyright © 2026 Alexander Thoukydides

// Marker for omitted text
const TRUNCATION_MARKER = '\n\n[…truncated…]\n\n';

// Truncate text (try to use good break points, but meet target regardless)
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
const wordSegmenter     = new Intl.Segmenter(undefined, { granularity: 'word' });
export function truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars)                return text;
    if (maxChars < TRUNCATION_MARKER.length)    return '';

    // Get the lengths of segments in the text according to a segmenter or regex
    const getSegmentOffsets = (str: string, segmenter: Intl.Segmenter): number[] => {
        const lengths: number[] = [];
        let lastIndex = 0;
        for (const { index } of segmenter.segment(str)) {
            if (index === 0) continue;
            lengths.push(index - lastIndex);
            lastIndex = index;
        }
        if (lastIndex < str.length) lengths.push(str.length - lastIndex);
        return lengths;
    };
    const getRegexOffsets = (str: string, regex: RegExp): number[] => {
        const lengths: number[] = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(str)) !== null) {
            lengths.push(match.index - lastIndex); // The text before the match
            lengths.push(match[0].length);         // The match itself (the delimiter)
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < str.length) lengths.push(str.length - lastIndex);
        return lengths;
    };

    // Search for a partition under the target length
    const findBestBreak = (maxChars: number, isSuffix: boolean): number => {
        const minChars = Math.floor(maxChars * 0.8);
        const partitionChars = Math.min(maxChars + Math.round(Math.max(maxChars * 0.2, 100)), text.length);
        const source = isSuffix ? text.slice(-partitionChars) : text.slice(0, partitionChars);

        // Partition the text with different granularity
        const partitionOffsets: number[][] = [
            getRegexOffsets(source, /\n\n+/g),  // (paragraphs)
            getRegexOffsets(source, /\n+/g),    // (lines)
            getSegmentOffsets(source, sentenceSegmenter),
            getSegmentOffsets(source, wordSegmenter)
        ];
        let length = 0;
        for (const offsets of partitionOffsets) {
            if (isSuffix) offsets.reverse();

            // Find longest length of this partition under the limit
            length = 0;
            for (const len of offsets) {
                if (maxChars < length + len) break;
                length += len;
            }
            if (minChars <= length) break;
        }
        return length;
    };

    // Cut out the middle of the text to end up under the target
    const maxPrefixChars = Math.floor((maxChars - TRUNCATION_MARKER.length) / 2);
    const prefixIndex = findBestBreak(maxPrefixChars, false);
    const prefix = text.substring(0, prefixIndex).trimEnd();
    const maxSuffixChars = maxChars - prefix.length - TRUNCATION_MARKER.length;
    const suffixIndex = findBestBreak(maxSuffixChars, true);
    const suffix = text.substring(suffixIndex).trimStart();
    return `${prefix}${TRUNCATION_MARKER}${suffix}`;
}