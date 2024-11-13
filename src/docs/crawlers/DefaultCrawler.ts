import { load } from 'cheerio';
import { BaseCrawler, PageData } from './BaseCrawler';

export class DefaultCrawler extends BaseCrawler {
    private visited = new Set<string>();

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

                // Remove script tags and comments
                $('script').remove();
                $('style').remove();
                $('comments').remove();

                // Extract title
                const title = $('title').text().trim() || $('h1').first().text().trim();

                // Extract main content
                const content = $('body')
                    .text()
                    .replace(/\s+/g, ' ')
                    .trim();

                // Get path from URL
                const path = url.pathname;

                yield {
                    url: urlString,
                    path,
                    title,
                    content,
                };

                // Find and queue new links
                $('a[href]').each((_, element) => {
                    try {
                        const href = $(element).attr('href');
                        if (!href) return;

                        const newUrl = new URL(href, urlString);
                        if (this.isValidUrl(newUrl) && !this.visited.has(newUrl.toString())) {
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
                throw error; // Let the DocsCrawler know this crawler failed
            }
        }
    }
}
