import { DeepPartial, QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import {
    Policy as SqlPolicy,
    Role as SqlRole,
    UserPermissions as SqlUserPermissions,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Policy as MongoPolicy,
    Role as MongoRole,
    UserPermissions as MongoUserPermissions,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import {
    DatabaseConnectionType,
    DatabaseEntity,
} from "../services/authorization.interface";
import { InternalServerError } from "../exceptions/InternalServerError.exception";

export type IAddPolicyToUserTransactionInput<
    IPolicy extends SqlPolicy | MongoPolicy,
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions,
    UserEntity extends DatabaseEntity
> = {
    subject: string;
    policy: IPolicy;
    user: UserEntity;
    policyCreationRequest: {
        resource: string;
        action: string;
    };
    userPermissions: IUserPermissions;
};

export type IAddPolicyToUserTransactionOutput<
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions
> = {
    userPermissions: IUserPermissions;
};

export type AddPolicyToUserTransactionInput<UserEntity extends DatabaseEntity> =
    {
        [DatabaseConnectionType.MONGO]: IAddPolicyToUserTransactionInput<
            MongoPolicy,
            MongoUserPermissions,
            UserEntity
        >;
        [DatabaseConnectionType.SQL]: IAddPolicyToUserTransactionInput<
            SqlPolicy,
            SqlUserPermissions,
            UserEntity
        >;
    };

export type AddPolicyToUserTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IAddPolicyToUserTransactionOutput<MongoUserPermissions>;
    [DatabaseConnectionType.SQL]: IAddPolicyToUserTransactionOutput<SqlUserPermissions>;
};

export class AddPolicyToUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    AddPolicyToUserTransactionInput<UserEntity>,
    AddPolicyToUserTransactionOutput
> {
    protected async executeSQL(
        data: AddPolicyToUserTransactionInput<UserEntity>[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<AddPolicyToUserTransactionOutput[DatabaseConnectionType.SQL]> {
        const { user, subject, policyCreationRequest } = data;
        let { policy } = data;
        let { userPermissions } = data;
        if (!userPermissions) {
            const userPermissionsDao: SqlUserPermissions =
                queryRunner.manager.create(SqlUserPermissions, {
                    subject,
                    policies: [],
                    roles: [],
                });
            userPermissions = await queryRunner.manager.save(
                SqlUserPermissions,
                userPermissionsDao
            );
        }

        if (!policy) {
            try {
                const policyDao: SqlPolicy = queryRunner.manager.create(
                    SqlPolicy,
                    {
                        action: policyCreationRequest?.action,
                        resource: policyCreationRequest?.resource,
                    }
                );
                policy = await queryRunner.manager.save(SqlPolicy, policyDao);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw err;
            }
        }
        if (!userPermissions?.policies?.length) {
            userPermissions.policies = [policy];
        }

        try {
            await queryRunner.manager.save(SqlUserPermissions, userPermissions);
        } catch (err) {
            this.logger.error("error saving user permissions", err as Error);
            throw err;
        }

        const userPolicyDenormDao: SqlUserPoliciesDenorm =
            queryRunner.manager.create(SqlUserPoliciesDenorm, {
                subject,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        try {
            await queryRunner.manager.save(
                SqlUserPoliciesDenorm,
                userPolicyDenormDao
            );
        } catch (err) {
            this.logger.error("error on saving denorm policy", err as Error);
            throw err;
        }

        return {
            userPermissions,
        };
    }

    protected async executeMongo(
        data: AddPolicyToUserTransactionInput<UserEntity>[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner
    ): Promise<AddPolicyToUserTransactionOutput[DatabaseConnectionType.MONGO]> {
        const { subject, policyCreationRequest } = data;
        let { policy } = data;
        let { userPermissions } = data;

        if (!policy) {
            try {
                const policyDao: MongoPolicy = queryRunner.manager.create(
                    MongoPolicy,
                    {
                        resource: policyCreationRequest.resource,
                        action: policyCreationRequest.action,
                    }
                );
                await queryRunner.manager.save(MongoPolicy, policyDao);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw new InternalServerError(err);
            }
        }

        if (!userPermissions) {
            try {
                const userPermissionsDao: MongoUserPermissions =
                    queryRunner.manager.create(MongoUserPermissions, {
                        subject,
                        policies: [],
                        roles: [],
                    });
                userPermissions = await queryRunner.manager.save(
                    MongoUserPermissions,
                    userPermissionsDao
                );
            } catch (err) {
                this.logger.error(
                    "error saving user permissions",
                    err as Error
                );
                throw new InternalServerError(err);
            }
        }

        try {
            const userPoliciesDenorm: MongoUserPoliciesDenorm =
                queryRunner.manager.create(MongoUserPoliciesDenorm, {
                    subject,
                    policyMapKey:
                        convertPolicyToPolicyMapKey<MongoPolicy>(policy),
                });
            await queryRunner.manager.save(
                MongoUserPoliciesDenorm,
                userPoliciesDenorm
            );
        } catch (err) {
            this.logger.error(
                "error saving user policies denorm",
                err as Error
            );
            throw new InternalServerError(err);
        }

        return { userPermissions };
    }
}
