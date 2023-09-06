import { Injectable } from "@nestjs/common";
import {
    ClientSession,
    DataSource,
    EntityManager,
    getConnection,
    MongoEntityManager,
    QueryRunner,
} from "typeorm";
import { Type } from "typescript";
import { DatabaseConnectionType } from "../authorization/services/authorization.interface";
import { Logger } from "./logger";

export type TransactionInputType = {
    [key in DatabaseConnectionType]: any;
};
export type TransactionOutputType = {
    [key in DatabaseConnectionType]: any;
};
export abstract class PrimaryTransaction<
    TransactionInput extends TransactionInputType,
    TransactionOutput extends TransactionOutputType
> {
    protected databaseType: DatabaseConnectionType;
    protected readonly logger = new Logger("primary_transaction");
    constructor(protected readonly datasource: DataSource) {
        if (
            ["postgres", "sqlite", "mysql", "sqljs", "better-sqlite3"].includes(
                datasource.options.type
            )
        ) {
            this.databaseType = DatabaseConnectionType.SQL;
        } else if (["mongodb"].includes(datasource.options.type)) {
            this.databaseType = DatabaseConnectionType.MONGO;
        } else {
            throw new Error("Unsupported database connection type");
        }
    }

    protected abstract executeSQL(
        data: TransactionInput[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<TransactionOutput[DatabaseConnectionType.SQL]>;

    protected abstract executeMongo(
        data: TransactionInput[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner,
        manager?: EntityManager
    ): Promise<TransactionOutput[DatabaseConnectionType.MONGO]>;

    async run(
        data:
            | TransactionInput[DatabaseConnectionType.SQL]
            | TransactionInput[DatabaseConnectionType.MONGO]
    ): Promise<
        | TransactionOutput[DatabaseConnectionType.SQL]
        | TransactionOutput[DatabaseConnectionType.MONGO]
    > {
        switch (this.databaseType) {
            case DatabaseConnectionType.SQL:
                return this.runSqlTransaction(data);
            case DatabaseConnectionType.MONGO:
                return this.runMongoTransaction(data);
            default:
                throw new Error("Database transaction not supported yet");
        }
    }

    private async runMongoTransaction(
        data: TransactionInput[DatabaseConnectionType.MONGO]
    ): Promise<TransactionOutput[DatabaseConnectionType.MONGO]> {
        return this.datasource.mongoManager.transaction<
            TransactionOutput[DatabaseConnectionType.MONGO]
        >((manager: EntityManager) =>
            this.executeMongo(data, manager.queryRunner, manager)
        );
    }

    private async runSqlTransaction(
        data: TransactionInput[DatabaseConnectionType.SQL]
    ): Promise<TransactionOutput[DatabaseConnectionType.SQL]> {
        const queryRunner: QueryRunner = this.datasource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const res: TransactionOutput[DatabaseConnectionType.SQL] =
                await this.executeSQL(data, queryRunner);
            await queryRunner.commitTransaction();
            return res;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}
