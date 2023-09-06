import { EntityManager, MongoEntityManager, QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import {
    Role as SqlRole,
    UserPermissions as SqlUserPermissions,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Role as MongoRole,
    UserPermissions as MongoUserPermissions,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import {
    DatabaseConnectionType,
    DatabaseEntity,
} from "../services/authorization.interface";
import { ObjectId } from "mongodb";
import { InternalServerError } from "../exceptions/InternalServerError.exception";

export type IRemoveRoleFromUserTransactionInput<
    IRole extends SqlRole | MongoRole,
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions,
    UserEntity extends DatabaseEntity
> = {
    role: IRole;
    user: UserEntity;
    subject: string;
    userPermissions: IUserPermissions;
};

export type IRemoveRoleFromUserTransactionOutput = {
    success: boolean;
};

export type RemoveRoleFromUserTransactionInput<
    UserEntity extends DatabaseEntity
> = {
    [DatabaseConnectionType.MONGO]: IRemoveRoleFromUserTransactionInput<
        MongoRole,
        MongoUserPermissions,
        UserEntity
    >;
    [DatabaseConnectionType.SQL]: IRemoveRoleFromUserTransactionInput<
        SqlRole,
        SqlUserPermissions,
        UserEntity
    >;
};

export type RemoveRoleFromUserTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IRemoveRoleFromUserTransactionOutput;
    [DatabaseConnectionType.SQL]: IRemoveRoleFromUserTransactionOutput;
};

export class RemoveRoleFromUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemoveRoleFromUserTransactionInput<UserEntity>,
    RemoveRoleFromUserTransactionOutput
> {
    protected async executeSQL(
        data: RemoveRoleFromUserTransactionInput<UserEntity>[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<
        RemoveRoleFromUserTransactionOutput[DatabaseConnectionType.SQL]
    > {
        const { role, subject, userPermissions } = data;

        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM user_permission_roles WHERE user_id=$1 AND role_id=$2`,
                [userPermissions.id, role.id]
            );
        } catch (err) {
            this.logger.error("error deleting role", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(SqlUserPoliciesDenorm, {
                subject,
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }

    protected async executeMongo(
        data: IRemoveRoleFromUserTransactionInput<
            MongoRole,
            MongoUserPermissions,
            UserEntity
        >,
        queryRunner: QueryRunner,
        manager: MongoEntityManager
    ): Promise<IRemoveRoleFromUserTransactionOutput> {
        const { role, user, subject, userPermissions } = data;

        userPermissions.roles = userPermissions.roles.filter(
            (roleId: ObjectId) => {
                return roleId.toString() !== role.id.toString();
            }
        );
        try {
            await manager.save(MongoUserPermissions, userPermissions);
        } catch (err) {
            this.logger.error("error updating user permissions", err as Error);
            throw new InternalServerError(err);
        }
        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                subject,
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw new InternalServerError(err);
        }

        return { success: true };
    }
}
