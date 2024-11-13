import { DocsCrawler } from './DocsCrawler';
import { DocsConfig } from '../types';

interface Article {
    title: string;
    content: string;
    subpath: string;
    url: string;
}

interface Chunk {
    content: string;
    article: Article;
}

interface IndexingProgressUpdate {
    progress: number;
    desc: string;
    status: 'indexing' | 'done' | 'failed';
}

interface EmbeddingsProvider {
    maxChunkSize: number;
    embed: (texts: string[]) => Promise<number[][]>;
}

export class DocsService {
    private docsIndexingQueue = new Set<string>();

    constructor(
        private docsCrawler: DocsCrawler,
        private embeddingsProvider: EmbeddingsProvider,
        private storage: {
            has: (key: string) => Promise<boolean>;
            delete: (key: string) => Promise<void>;
            add: (data: {
                siteIndexingConfig: DocsConfig;
                chunks: Chunk[];
                embeddings: number[][];
                favicon?: string;
            }) => Promise<void>;
        }
    ) {}

    async *indexSite(
        siteIndexingConfig: DocsConfig,
        reIndex: boolean = false,
    ): AsyncGenerator<IndexingProgressUpdate> {
        const { startUrl } = siteIndexingConfig;

        if (this.docsIndexingQueue.has(startUrl)) {
            console.log("Already in queue");
            return;
        }

        if (!reIndex && (await this.storage.has(startUrl))) {
            yield {
                progress: 1,
                desc: "Already indexed",
                status: "done",
            };
            return;
        }

        // Mark the site as currently being indexed
        this.docsIndexingQueue.add(startUrl);

        yield {
            progress: 0,
            desc: "Finding subpages",
            status: "indexing",
        };

        const articles: Article[] = [];
        let processedPages = 0;
        let maxKnownPages = 1;

        try {
            // Crawl pages and retrieve info as articles
            for await (const page of this.docsCrawler.crawl(new URL(startUrl))) {
                processedPages++;

                const article = {
                    title: page.title,
                    content: page.content,
                    subpath: page.path,
                    url: page.url,
                };

                articles.push(article);

                // Use a heuristic approach for progress calculation
                const progress = Math.min(processedPages / maxKnownPages, 1);

                yield {
                    progress,
                    desc: `Finding subpages (${page.path})`,
                    status: "indexing",
                };

                // Increase maxKnownPages to delay progress reaching 100% too soon
                if (processedPages === maxKnownPages) {
                    maxKnownPages *= 2;
                }
            }

            const chunks: Chunk[] = [];
            const embeddings: number[][] = [];

            // Create embeddings of retrieved articles
            console.log(`Creating embeddings for ${articles.length} articles`);

            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                yield {
                    progress: i / articles.length,
                    desc: `Creating Embeddings: ${article.subpath}`,
                    status: "indexing",
                };

                try {
                    const articleChunks = this.chunkArticle(
                        article,
                        this.embeddingsProvider.maxChunkSize,
                    );

                    const chunkContents = articleChunks.map(
                        (chunk) => chunk.content,
                    );

                    chunks.push(...articleChunks);

                    const chunkEmbeddings = await this.embeddingsProvider.embed(
                        chunkContents,
                    );

                    embeddings.push(...chunkEmbeddings);
                } catch (e) {
                    console.warn("Error chunking article: ", e);
                }
            }

            if (embeddings.length === 0) {
                console.error(
                    `No embeddings were created for site: ${siteIndexingConfig.startUrl}\n Num chunks: ${chunks.length}`,
                );

                yield {
                    progress: 1,
                    desc: `No embeddings were created for site: ${siteIndexingConfig.startUrl}`,
                    status: "failed",
                };

                return;
            }

            // Add docs to storage
            console.log(`Adding ${embeddings.length} embeddings to storage`);

            yield {
                progress: 0.9,
                desc: `Adding ${embeddings.length} embeddings to storage`,
                status: "indexing",
            };

            // Delete indexed docs if re-indexing
            if (reIndex && (await this.storage.has(startUrl))) {
                console.log("Deleting old embeddings");
                await this.storage.delete(startUrl);
            }

            await this.storage.add({
                siteIndexingConfig,
                chunks,
                embeddings,
            });

            yield {
                progress: 1,
                desc: "Done",
                status: "done",
            };

            console.log(`Successfully indexed: ${siteIndexingConfig.startUrl}`);
        } finally {
            this.docsIndexingQueue.delete(startUrl);
        }
    }

    private chunkArticle(article: Article, maxChunkSize: number): Chunk[] {
        const chunks: Chunk[] = [];
        const words = article.content.split(/\s+/);
        let currentChunk: string[] = [];
        let currentSize = 0;

        for (const word of words) {
            if (currentSize + word.length > maxChunkSize && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join(' '),
                    article,
                });
                currentChunk = [];
                currentSize = 0;
            }
            currentChunk.push(word);
            currentSize += word.length + 1; // +1 for space
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join(' '),
                article,
            });
        }

        return chunks;
    }
}
