import { load } from 'cheerio';
import { BaseCrawler, PageData } from './BaseCrawler';

export class CheerioCrawler extends BaseCrawler {
    private visited = new Set<string>();
    private readonly contentSelectors = [
        'article',
        'main',
        '.content',
        '.documentation',
        '.docs-content',
        '#content',
        '#main',
    ];

    async *crawl(maxRequestsPerCrawl = this.MAX_REQUESTS_PER_CRAWL): AsyncGenerator<PageData> {
        const queue: URL[] = [this.startUrl];
        let requestCount = 0;

        while (queue.length > 0 && requestCount < maxRequestsPerCrawl) {
            const url = queue.shift()!;
            const urlString = url.toString();

            if (this.visited.has(urlString)) {
                continue;
            }

            try {
                const response = await fetch(urlString);
                if (!response.ok) {
                    console.error(`Failed to fetch ${urlString}: ${response.statusText}`);
                    continue;
                }

                const html = await response.text();
                const $ = load(html);

                // Remove non-content elements
                $('script, style, nav, footer, header, .navigation, .sidebar, .menu, .ads').remove();

                // Extract title
                const title = $('title').text().trim() || 
                            $('h1').first().text().trim() || 
                            $('meta[property="og:title"]').attr('content') || 
                            '';

                // Try to find main content using common selectors
                let content = '';
                for (const selector of this.contentSelectors) {
                    const element = $(selector);
                    if (element.length > 0) {
                        content = element.text().trim();
                        break;
                    }
                }

                // Fallback to body if no content found
                if (!content) {
                    content = $('body').text().trim();
                }

                // Clean up content
                content = content
                    .replace(/\s+/g, ' ')
                    .replace(/\n+/g, '\n')
                    .trim();

                const path = url.pathname;

                yield {
                    url: urlString,
                    path,
                    title,
                    content,
                };

                // Find and queue new links, focusing on documentation-like paths
                $('a[href]').each((_, element) => {
                    try {
                        const href = $(element).attr('href');
                        if (!href) return;

                        // Skip anchor links and obvious non-documentation paths
                        if (href.startsWith('#') || 
                            href.includes('?') || 
                            /\.(jpg|jpeg|png|gif|svg|css|js)$/i.test(href)) {
                            return;
                        }

                        const newUrl = new URL(href, urlString);
                        
                        // Only follow paths that look like documentation
                        if (this.isValidUrl(newUrl) && 
                            this.isLikelyDocPath(newUrl.pathname) && 
                            !this.visited.has(newUrl.toString())) {
                            queue.push(newUrl);
                        }
                    } catch (error) {
                        console.error(`Error processing link: ${error}`);
                    }
                });

                this.visited.add(urlString);
                requestCount++;
            } catch (error) {
                console.error(`Error crawling ${urlString}: ${error}`);
                continue;
            }
        }
    }

    private isLikelyDocPath(path: string): boolean {
        const docPatterns = [
            /docs?/i,
            /api/i,
            /guide/i,
            /tutorial/i,
            /manual/i,
            /reference/i,
            /learn/i,
            /getting-started/i,
        ];

        return docPatterns.some(pattern => pattern.test(path));
    }
}
