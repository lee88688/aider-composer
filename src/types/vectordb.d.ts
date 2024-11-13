declare module 'vectordb' {
    export function connect(path: string): Promise<Database>;

    export interface Database {
        openTable(name: string): Promise<Table>;
        createTable(name: string, data: any[]): Promise<Table>;
    }

    export interface Table {
        add(data: any[]): Promise<void>;
        search(vector: number[]): TableSearch;
        delete(): TableDelete;
    }

    export interface TableSearch {
        where(condition: string): TableSearch;
        limit(n: number): TableSearch;
        execute(): Promise<any[]>;
    }

    export interface TableDelete {
        where(condition: string): TableDelete;
        execute(): Promise<void>;
    }
}

declare module 'vectordb/table' {
    export interface Table {
        add(data: any[]): Promise<void>;
        search(vector: number[]): TableSearch;
        delete(): TableDelete;
    }

    export interface TableSearch {
        where(condition: string): TableSearch;
        limit(n: number): TableSearch;
        execute(): Promise<any[]>;
    }

    export interface TableDelete {
        where(condition: string): TableDelete;
        execute(): Promise<void>;
    }
}
