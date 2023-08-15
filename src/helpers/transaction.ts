import { Injectable } from "@nestjs/common";
import { DataSource, QueryRunner } from "typeorm";
import { Logger } from "./logger";

export abstract class PrimaryTransaction<TransactionInput, TransactionOutput> {
    protected readonly logger = new Logger("primary_transaction");
    constructor(protected readonly datasource: DataSource) {}

    protected abstract execute(
        data: TransactionInput,
        queryRunner: QueryRunner
    ): Promise<TransactionOutput>;

    async run(data: TransactionInput): Promise<TransactionOutput> {
        const queryRunner: QueryRunner = this.datasource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const res: TransactionOutput = await this.execute(
                data,
                queryRunner
            );
            await queryRunner.commitTransaction();
            return res;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async runWithinTransaction(
        data: TransactionInput,
        queryRunner: QueryRunner
    ): Promise<TransactionOutput> {
        return this.execute(data, queryRunner);
    }
}
