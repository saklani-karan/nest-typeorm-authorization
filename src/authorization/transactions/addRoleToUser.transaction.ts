import { Injectable } from "@nestjs/common";
import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { RoleAlreadyExistsOnUserException } from "../exceptions/RoleExistsException.exception";
import { DatabaseEntity } from "../services/authorization.interface";

export class AddToUserTransactionInput<UserEntity extends DatabaseEntity> {
    role: Role;
    subject: string;
    user: UserEntity;
}

export class AddToUserTransactionOutput {
    success: boolean;
}

export class AddRoleToUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    AddToUserTransactionInput<UserEntity>,
    AddToUserTransactionOutput
> {
    protected async execute(
        data: AddToUserTransactionInput<UserEntity>,
        queryRunner: QueryRunner
    ): Promise<AddToUserTransactionOutput> {
        this.logger.info(`received with params ${JSON.stringify(data)}`);
        const { subject, role, user } = data;
        let userPermissions: UserPermissions,
            policiesForRole: Role,
            userPoliciesDenorm: Array<UserPoliciesDenorm>;
        try {
            [userPermissions, policiesForRole, userPoliciesDenorm] =
                await Promise.all([
                    queryRunner.manager
                        .findOne<UserPermissions>(UserPermissions, {
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
                        .findOne<Role>(Role, {
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
                        .find<UserPoliciesDenorm>(UserPoliciesDenorm, {
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
                    UserPermissions,
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
        userPermissions.roles?.forEach((userRole: Role) => {
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
                UserPermissions,
                userPermissions
            );
        } catch (err) {
            this.logger.error(
                "error updating user permissions with role",
                err as Error
            );
            throw err;
        }

        const userPoliciesDenormToInsert: Array<UserPoliciesDenorm> = [];
        policiesForRole?.policies?.forEach((policy: Policy) => {
            const policyMapKey: string = convertPolicyToPolicyMapKey(policy);
            const userPolicyDenorm: UserPoliciesDenorm =
                queryRunner.manager.create<UserPoliciesDenorm>(
                    UserPoliciesDenorm,
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
                    UserPoliciesDenorm,
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
}
