// Global content filtering rules applied to every AI prompt across the platform
// Add to every system prompt that generates or surfaces content

export const CONTENT_FILTER = `
CONTENT FILTERING RULES (NON-NEGOTIABLE):
- NEVER include, reference, or surface any sexually explicit, NSFW, or lewd content
- NEVER include political content, political opinions, or partisan messaging
- NEVER include religious commentary or religious debate
- NEVER include hate speech, discrimination, or content targeting protected groups
- NEVER include graphic violence or gore
- NEVER include drug use promotion
- If source data contains any of the above, SKIP it entirely and do not mention it
- Filter out any Reddit/social posts that are off-topic for the brand's actual product category
- Only surface content that is directly relevant to the brand's industry, product, and target audience
- When in doubt, exclude rather than include
`

export const RELEVANCE_FILTER = `
RELEVANCE RULES:
- Only include signals and insights that are DIRECTLY relevant to the brand's product category
- Skip posts from unrelated subreddits even if they mention a keyword
- Skip content that uses brand keywords in a different context
- A post about "foot pain" in a medical emergency context is NOT relevant to a shoe brand
- A post about "supplements" in a bodybuilding context may NOT be relevant to a women's wellness brand
- Always consider the brand's target demographic when evaluating relevance
`
