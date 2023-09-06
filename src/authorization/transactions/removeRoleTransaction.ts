import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import {
    Role as SqlRole,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Role as MongoRole,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
    UserPermissions as MongoUserPermissions,
} from "../entities/mongodb";
import { DatabaseConnectionType } from "../services/authorization.interface";
import { InternalServerError } from "../exceptions/InternalServerError.exception";
import { ObjectId } from "mongodb";
import { chunk } from "lodash";

export type IRemoveRoleTransactionInput<IRole extends MongoRole | SqlRole> = {
    role: IRole;
};

export type IRemoveRoleTransactionOutput = {
    success: boolean;
};

export type RemoveRoleTransactionInput = {
    [DatabaseConnectionType.MONGO]: IRemoveRoleTransactionInput<MongoRole>;
    [DatabaseConnectionType.SQL]: IRemoveRoleTransactionInput<SqlRole>;
};

export type RemoveRoleTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IRemoveRoleTransactionOutput;
    [DatabaseConnectionType.SQL]: IRemoveRoleTransactionOutput;
};

export class RemoveRoleTransaction extends PrimaryTransaction<
    RemoveRoleTransactionInput,
    RemoveRoleTransactionOutput
> {
    protected async executeSQL(
        data: RemoveRoleTransactionInput[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<RemoveRoleTransactionOutput[DatabaseConnectionType.MONGO]> {
        const { role } = data;
        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM user_permission_roles WHERE role_id=$1`,
                [role.id]
            );
        } catch (err) {
            this.logger.error(
                "error deleting role from user permissions",
                err as Error
            );
            throw err;
        }

        try {
            await queryRunner.manager.delete(SqlUserPoliciesDenorm, {
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.remove<SqlRole>(role);
        } catch (err) {
            this.logger.error("error deleting role", err as Error);
            throw err;
        }

        return { success: true };
    }

    protected async executeMongo(
        data: IRemoveRoleTransactionInput<MongoRole>,
        queryRunner: QueryRunner
    ): Promise<IRemoveRoleTransactionOutput> {
        const { role } = data;

        let userPermissions: MongoUserPermissions[];
        try {
            userPermissions = await queryRunner.manager
                .getMongoRepository(MongoUserPermissions)
                .aggregate([
                    {
                        $match: {
                            roles: {
                                $elemMatch: {
                                    $eq: role.id,
                                },
                            },
                        },
                    },
                ])
                .toArray();
        } catch (err) {
            this.logger.error("error fetching user permissions");
            throw new InternalServerError(err);
        }

        userPermissions.forEach((userPermission: MongoUserPermissions) => {
            userPermission.roles = userPermission.roles.filter(
                (roleId: ObjectId) => {
                    return roleId.toString() !== role.id.toString();
                }
            );
        });

        const insertedChunks: MongoUserPermissions[][] = chunk(
            userPermissions,
            10000
        );
        try {
            for (let chunk of insertedChunks) {
                await queryRunner.manager.save(MongoUserPermissions, chunk);
            }
        } catch (err) {
            this.logger.error(
                "error removing role from user permissions for user"
            );
            throw new InternalServerError(err);
        }

        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting policies denorm", err as Error);
            throw new InternalServerError(err);
        }

        return { success: true };
    }
}
