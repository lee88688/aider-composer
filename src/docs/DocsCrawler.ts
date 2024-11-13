import { DefaultCrawler } from './crawlers/DefaultCrawler';
import { CheerioCrawler } from './crawlers/CheerioCrawler';
import { ChromiumCrawler } from './crawlers/ChromiumCrawler';
import { PageData } from './crawlers/BaseCrawler';

export class DocsCrawler {
    private readonly MAX_REQUESTS_PER_CRAWL = 1000;
    private readonly GITHUB_HOST = 'github.com';

    constructor(private chromiumInstaller: { 
        shouldProposeUseChromium: () => boolean;
        proposeAndAttemptInstall: (url: string) => Promise<boolean>;
    }) {}

    async *crawl(
        startUrl: URL,
        maxRequestsPerCrawl: number = this.MAX_REQUESTS_PER_CRAWL,
    ): AsyncGenerator<PageData> {
        if (startUrl.host === this.GITHUB_HOST) {
            // GitHub docs require special handling
            yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
            return;
        }

        try {
            // Try the simple crawler first
            yield* new DefaultCrawler(startUrl, maxRequestsPerCrawl).crawl();
            return;
        } catch (e) {
            console.error("Default crawler failed, trying backup: ", e);
        }

        try {
            // Try Cheerio crawler next
            let didCrawlSinglePage = false;

            for await (const pageData of new CheerioCrawler(
                startUrl,
                maxRequestsPerCrawl,
            ).crawl()) {
                yield pageData;
                didCrawlSinglePage = true;
            }

            if (didCrawlSinglePage) {
                return;
            }
        } catch (e) {
            console.error("Cheerio crawler failed, trying Chromium: ", e);
        }

        // If both simple crawlers failed, try Chromium
        const shouldProposeUseChromium = this.chromiumInstaller.shouldProposeUseChromium();

        if (shouldProposeUseChromium) {
            const didInstall = await this.chromiumInstaller.proposeAndAttemptInstall(
                startUrl.toString(),
            );

            if (didInstall) {
                console.log(`Successfully installed Chromium! Retrying crawl of: ${startUrl.toString()}`);
                yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
            }
        } else {
            // If we shouldn't propose Chromium, try it anyway if it's already installed
            try {
                yield* new ChromiumCrawler(startUrl, maxRequestsPerCrawl).crawl();
            } catch (e) {
                console.error("All crawlers failed: ", e);
                throw new Error(`Failed to crawl ${startUrl.toString()} with all available crawlers`);
            }
        }
    }
}
