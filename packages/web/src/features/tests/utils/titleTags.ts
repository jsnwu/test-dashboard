/**
 * Extract Playwright-style title tags (`@smoke`, `@slow`, etc.) from a test name
 * and return a display title with those tokens removed.
 */
export function parseTestNameTags(name: string): {displayName: string; tags: string[]} {
    if (!name?.trim()) {
        return {displayName: name || '', tags: []}
    }

    const tagRe = /@([\w.-]+)/g
    const tags: string[] = []
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(name)) !== null) {
        tags.push(`@${m[1]}`)
    }

    const displayName = name
        .replace(/@([\w.-]+)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

    return {displayName, tags}
}
