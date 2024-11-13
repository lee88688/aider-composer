import * as puppeteer from 'puppeteer';
import { BaseCrawler, PageData } from './BaseCrawler';

export class ChromiumCrawler extends BaseCrawler {
    private visited = new Set<string>();
    private browser: puppeteer.Browser | null = null;

    async *crawl(maxRequestsPerCrawl = this.MAX_REQUESTS_PER_CRAWL): AsyncGenerator<PageData> {
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const queue: URL[] = [this.startUrl];
            let requestCount = 0;

            while (queue.length > 0 && requestCount < maxRequestsPerCrawl) {
                const url = queue.shift()!;
                const urlString = url.toString();

                if (this.visited.has(urlString)) {
                    continue;
                }

                try {
                    const page = await this.browser.newPage();
                    await page.goto(urlString, {
                        waitUntil: 'networkidle0',
                        timeout: 30000
                    });

                    // Wait for common documentation content selectors
                    await Promise.race([
                        page.waitForSelector('article'),
                        page.waitForSelector('main'),
                        page.waitForSelector('.content'),
                        page.waitForSelector('.documentation'),
                        page.waitForSelector('#content'),
                        page.waitForTimeout(5000) // Fallback timeout
                    ]);

                    // Remove non-content elements
                    await page.evaluate(() => {
                        const elementsToRemove = document.querySelectorAll(
                            'script, style, nav, footer, header, .navigation, .sidebar, .menu, .ads'
                        );
                        elementsToRemove.forEach(el => el.remove());
                    });

                    // Extract content
                    const data = await page.evaluate(() => {
                        const getContent = () => {
                            const selectors = [
                                'article',
                                'main',
                                '.content',
                                '.documentation',
                                '#content',
                                '#main'
                            ];

                            for (const selector of selectors) {
                                const element = document.querySelector(selector);
                                if (element) {
                                    return element.textContent || '';
                                }
                            }

                            return document.body.textContent || '';
                        };

                        return {
                            title: document.title || document.querySelector('h1')?.textContent || '',
                            content: getContent(),
                            links: Array.from(document.querySelectorAll('a[href]'))
                                .map(a => a.getAttribute('href'))
                                .filter(href => href && !href.startsWith('#'))
                        };
                    });

                    yield {
                        url: urlString,
                        path: url.pathname,
                        title: data.title.trim(),
                        content: data.content.replace(/\s+/g, ' ').trim()
                    };

                    // Queue new links
                    for (const href of data.links) {
                        try {
                            if (!href) continue;
                            const newUrl = new URL(href, urlString);
                            if (this.isValidUrl(newUrl) && 
                                this.isLikelyDocPath(newUrl.pathname) && 
                                !this.visited.has(newUrl.toString())) {
                                queue.push(newUrl);
                            }
                        } catch (error) {
                            console.error(`Error processing link: ${error}`);
                        }
                    }

                    await page.close();
                    this.visited.add(urlString);
                    requestCount++;
                } catch (error) {
                    console.error(`Error crawling ${urlString}: ${error}`);
                    continue;
                }
            }
        } finally {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
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
