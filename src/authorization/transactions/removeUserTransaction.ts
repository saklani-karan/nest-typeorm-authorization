import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import {
    UserPermissions as SqlUserPermissions,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    UserPermissions as MongoUserPermissions,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import {
    DatabaseConnectionType,
    DatabaseEntity,
} from "../services/authorization.interface";
import { InternalServerError } from "../exceptions/InternalServerError.exception";

export class IRemoveUserTransactionInput<UserEntity extends DatabaseEntity> {
    user: UserEntity;
    subject: string;
    deleteUser: boolean = false;
}

export type IRemoveUserTransactionOutput = {
    success: boolean;
};

export type RemoveUserTransactionInput<UserEntity extends DatabaseEntity> = {
    [DatabaseConnectionType.MONGO]: IRemoveUserTransactionInput<UserEntity>;
    [DatabaseConnectionType.SQL]: IRemoveUserTransactionInput<UserEntity>;
};

export type RemoveUserTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IRemoveUserTransactionOutput;
    [DatabaseConnectionType.SQL]: IRemoveUserTransactionOutput;
};

export class RemoveUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemoveUserTransactionInput<UserEntity>,
    RemoveUserTransactionOutput
> {
    protected async executeSQL(
        data: RemoveUserTransactionInput<UserEntity>[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<RemoveUserTransactionOutput[DatabaseConnectionType.SQL]> {
        const { user, subject, deleteUser } = data;

        try {
            await queryRunner.manager.delete(MongoUserPermissions, { subject });
        } catch (err) {
            this.logger.error("error deleting user permissions", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                subject,
            });
        } catch (err) {
            this.logger.error("error denorm policies from user", err as Error);
            throw err;
        }

        if (deleteUser) {
            try {
                await queryRunner.manager.remove<UserEntity>(user);
            } catch (err) {
                this.logger.error("error deleting user", err as Error);
                throw err;
            }
        }

        return {
            success: true,
        };
    }

    protected async executeMongo(
        data: RemoveUserTransactionInput<UserEntity>[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner
    ): Promise<RemoveUserTransactionOutput[DatabaseConnectionType.MONGO]> {
        const { user, subject, deleteUser } = data;

        try {
            await queryRunner.manager.delete(MongoUserPermissions, {
                subject,
            });
        } catch (err) {
            this.logger.error("error deleting user permissions", err as Error);
            throw new InternalServerError(err);
        }

        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                subject,
            });
        } catch (err) {
            this.logger.error(
                "error deleting user denorm policies",
                err as Error
            );
            throw new InternalServerError(err);
        }

        if (deleteUser) {
            try {
                await queryRunner.manager.remove<UserEntity>(user);
            } catch (err) {
                this.logger.error("error deleting user", err as Error);
                throw new InternalServerError(err);
            }
        }

        return { success: true };
    }
}
