import { connect } from 'vectordb';
import { DocsConfig } from '../../types';
import { Table } from 'vectordb/table';

interface LanceDbDocsRow {
    id: string;
    content: string;
    embedding: number[];
    title: string;
    url: string;
    starturl: string;
    subpath: string;
}

export class LanceDbStorage {
    private table: Table | null = null;
    private readonly tableName = 'docs';

    constructor(private dbPath: string) {}

    private async getOrCreateTable(initializationVector: number[]): Promise<Table> {
        if (this.table) {
            return this.table;
        }

        const db = await connect(this.dbPath);
        
        try {
            this.table = await db.openTable(this.tableName);
        } catch {
            // Table doesn't exist, create it
            this.table = await db.createTable(this.tableName, [{
                id: 'init',
                content: '',
                embedding: initializationVector,
                title: '',
                url: '',
                starturl: '',
                subpath: '',
            }]);
        }

        return this.table;
    }

    async has(startUrl: string): Promise<boolean> {
        const table = await this.getOrCreateTable([0]); // Dummy vector for initialization
        const result = await table
            .search([0])
            .where(`starturl = '${startUrl}'`)
            .limit(1)
            .execute();
        return result.length > 0;
    }

    async delete(startUrl: string): Promise<void> {
        const table = await this.getOrCreateTable([0]); // Dummy vector for initialization
        await table.delete().where(`starturl = '${startUrl}'`).execute();
    }

    async add(data: {
        siteIndexingConfig: DocsConfig;
        chunks: Array<{
            content: string;
            article: {
                title: string;
                url: string;
                subpath: string;
            };
        }>;
        embeddings: number[][];
    }): Promise<void> {
        const { siteIndexingConfig, chunks, embeddings } = data;
        
        if (chunks.length !== embeddings.length) {
            throw new Error('Chunks and embeddings length mismatch');
        }

        const rows: LanceDbDocsRow[] = chunks.map((chunk, i) => ({
            id: `${siteIndexingConfig.startUrl}-${i}`,
            content: chunk.content,
            embedding: embeddings[i],
            title: chunk.article.title,
            url: chunk.article.url,
            starturl: siteIndexingConfig.startUrl,
            subpath: chunk.article.subpath,
        }));

        const table = await this.getOrCreateTable(embeddings[0]);
        await table.add(rows);
    }

    async search(
        vector: number[],
        startUrl: string,
        limit: number = 5
    ): Promise<Array<{
        content: string;
        title: string;
        url: string;
        subpath: string;
        score: number;
    }>> {
        const table = await this.getOrCreateTable(vector);
        const results = await table
            .search(vector)
            .where(`starturl = '${startUrl}'`)
            .limit(limit)
            .execute();

        return results.map(result => ({
            content: result.content,
            title: result.title,
            url: result.url,
            subpath: result.subpath,
            score: result.score,
        }));
    }
}
