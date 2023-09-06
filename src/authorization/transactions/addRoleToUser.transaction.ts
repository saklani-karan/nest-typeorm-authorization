import { Injectable } from "@nestjs/common";
import { DeepPartial, EntityManager, In, QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { RoleAlreadyExistsOnUserException } from "../exceptions/RoleExistsException.exception";
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
import { Logger } from "../../helpers/logger";
import { ObjectId } from "mongodb";
import { chunk } from "lodash";

export type AddRoleToUserTransactionInput<UserEntity extends DatabaseEntity> = {
    [DatabaseConnectionType.MONGO]: {
        role: MongoRole;
        subject: string;
        user: UserEntity;
        policies: MongoPolicy[];
    };
    [DatabaseConnectionType.SQL]: {
        role: SqlRole;
        subject: string;
        user: UserEntity;
    };
};

export type IAddRoleToUserTransactionOutput = {
    success: boolean;
};

export type AddRoleToUserTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IAddRoleToUserTransactionOutput;
    [DatabaseConnectionType.SQL]: IAddRoleToUserTransactionOutput;
};

export class AddRoleToUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    AddRoleToUserTransactionInput<UserEntity>,
    AddRoleToUserTransactionOutput
> {
    protected async executeSQL(
        data: AddRoleToUserTransactionInput<UserEntity>[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<AddRoleToUserTransactionOutput[DatabaseConnectionType.SQL]> {
        this.logger.info(`received with params ${JSON.stringify(data)}`);
        const { subject, role, user } = data;
        let userPermissions: SqlUserPermissions,
            policiesForRole: SqlRole,
            userPoliciesDenorm: Array<SqlUserPoliciesDenorm>;
        try {
            [userPermissions, policiesForRole, userPoliciesDenorm] =
                await Promise.all([
                    queryRunner.manager
                        .findOne<SqlUserPermissions>(SqlUserPermissions, {
                            where: {
                                subject,
                            },
                            relations: {
                                roles: true,
                            },
                        })
                        .catch((err: Error) => {
                            this.logger.error(
                                "error fetching user permissions",
                                err
                            );
                            throw err;
                        }),
                    queryRunner.manager
                        .findOne<SqlRole>(SqlRole, {
                            where: {
                                id: role.id,
                            },
                            relations: {
                                policies: true,
                            },
                        })
                        .catch((err: Error) => {
                            this.logger.error("error fetching user role", err);
                            throw err;
                        }),
                    queryRunner.manager
                        .find<SqlUserPoliciesDenorm>(SqlUserPoliciesDenorm, {
                            where: {
                                subject,
                            },
                        })
                        .catch((err: Error) => {
                            this.logger.error(
                                "error fetching denorm policies",
                                err
                            );
                            throw err;
                        }),
                ]);
        } catch (err) {
            this.logger.error(
                `error fetching data for transaction`,
                err as Error
            );
        }

        if (!userPermissions) {
            this.logger.info(
                "userPermissions not found, creating new permissions"
            );
            try {
                userPermissions = await queryRunner.manager.save(
                    SqlUserPermissions,
                    {
                        subject,
                        roles: [],
                        policies: [],
                    }
                );
            } catch (err) {
                this.logger.error(
                    "error creating user permissions",
                    err as Error
                );
                throw err;
            }
        }

        this.logger.info("checking if role already exists");
        userPermissions.roles?.forEach((userRole: SqlRole) => {
            if (userRole.id === role.id) {
                const roleAlreadyExistsOnUserException =
                    new RoleAlreadyExistsOnUserException({
                        role: role.name,
                        user: subject,
                    });
                this.logger.error(
                    `role already exists on user`,
                    roleAlreadyExistsOnUserException
                );
                throw roleAlreadyExistsOnUserException;
            }
        });
        this.logger.info("check complete for role on user");
        userPermissions.roles.push(role);

        try {
            userPermissions = await queryRunner.manager.save(
                SqlUserPermissions,
                userPermissions
            );
        } catch (err) {
            this.logger.error(
                "error updating user permissions with role",
                err as Error
            );
            throw err;
        }

        const userPoliciesDenormToInsert: Array<SqlUserPoliciesDenorm> = [];
        policiesForRole?.policies?.forEach((policy: SqlPolicy) => {
            const policyMapKey: string = convertPolicyToPolicyMapKey(policy);
            const userPolicyDenorm: SqlUserPoliciesDenorm =
                queryRunner.manager.create<SqlUserPoliciesDenorm>(
                    SqlUserPoliciesDenorm,
                    {
                        subject,
                        policyMapKey,
                        roleKey: role.name,
                    }
                );
            userPoliciesDenormToInsert.push(userPolicyDenorm);
        });

        if (userPoliciesDenormToInsert?.length) {
            try {
                await queryRunner.manager.save(
                    SqlUserPoliciesDenorm,
                    userPoliciesDenormToInsert
                );
            } catch (err) {
                this.logger.error(
                    "error updating user policies denorm",
                    err as Error
                );
                throw err;
            }
        }

        return { success: true };
    }

    protected async executeMongo(
        data: AddRoleToUserTransactionInput<UserEntity>[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner,
        manager: EntityManager
    ): Promise<AddRoleToUserTransactionOutput[DatabaseConnectionType.MONGO]> {
        const logger: Logger = this.logger.createForMethod("executeMongo");

        const { role, subject, user, policies } = data;

        let userPermissions: MongoUserPermissions = await manager.findOne(
            MongoUserPermissions,
            {
                where: {
                    subject,
                },
            }
        );
        if (!userPermissions) {
            userPermissions = manager.create(MongoUserPermissions, {
                subject,
                roles: [],
            });
        }
        userPermissions.roles.push(role.id);
        try {
            await manager.save(MongoUserPermissions, userPermissions);
        } catch (err) {
            logger.error("error updating user permissions", err as Error);
            throw err;
        }
        const userPoliciesDenorm: DeepPartial<Array<MongoUserPoliciesDenorm>> =
            policies.map((policy: Pick<MongoPolicy, "resource" | "action">) => {
                return {
                    subject,
                    policyMapKey:
                        convertPolicyToPolicyMapKey<MongoPolicy>(policy),
                    roleKey: role.name,
                };
            });
        console.log(userPoliciesDenorm);
        const insertChunks: DeepPartial<MongoUserPoliciesDenorm>[][] = chunk(
            userPoliciesDenorm,
            1000
        );

        try {
            for (let chunk of insertChunks) {
                await manager.save(MongoUserPoliciesDenorm, chunk);
            }
        } catch (err) {
            this.logger.error(
                "error creating denorm user policies",
                err as Error
            );
            throw err;
        }

        return { success: true };
    }
}
