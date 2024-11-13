export interface PageData {
    url: string;
    path: string;
    title: string;
    content: string;
}

export abstract class BaseCrawler {
    protected readonly MAX_REQUESTS_PER_CRAWL = 1000;
    protected readonly GITHUB_HOST = 'github.com';

    constructor(protected startUrl: URL) {}

    abstract crawl(maxRequestsPerCrawl?: number): AsyncGenerator<PageData>;

    protected isValidUrl(url: URL): boolean {
        return url.host === this.startUrl.host;
    }
}
