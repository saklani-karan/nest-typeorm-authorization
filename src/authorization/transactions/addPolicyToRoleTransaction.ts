import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import {
    Policy as SqlPolicy,
    Role as SqlRole,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Policy as MongoPolicy,
    Role as MongoRole,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import { PolicyAlreadyAttachedOnRoleException } from "../exceptions/PolicyAlreadyAttachedOnRoleException.exception";
import { DatabaseConnectionType } from "../services/authorization.interface";
import { ObjectId } from "mongodb";
import { chunk } from "lodash";
import { InternalServerError } from "../exceptions/InternalServerError.exception";

export type CreatePolicyTransactionParams = {
    resource: string;
    action: string;
};

export type IAddRoleToPolicyTransactionInput<
    IRole extends SqlRole | MongoRole,
    IPolicy extends SqlPolicy | MongoPolicy
> = {
    createPolicyParams?: CreatePolicyTransactionParams;
    policy?: IPolicy;
    role: IRole;
};

export type IAddRoleToPolicyTransactionOutput<
    IRole extends SqlRole | MongoRole,
    IPolicy extends SqlPolicy | MongoPolicy
> = {
    role: IRole;
    policy: IPolicy;
};

export type AddRoleToPolicyTransactionInput = {
    [DatabaseConnectionType.SQL]: IAddRoleToPolicyTransactionInput<
        SqlRole,
        SqlPolicy
    >;
    [DatabaseConnectionType.MONGO]: IAddRoleToPolicyTransactionInput<
        MongoRole,
        MongoPolicy
    >;
};

export type AddRoleToPolicyTransactionOutput = {
    [DatabaseConnectionType.SQL]: IAddRoleToPolicyTransactionOutput<
        SqlRole,
        SqlPolicy
    >;
    [DatabaseConnectionType.MONGO]: IAddRoleToPolicyTransactionOutput<
        MongoRole,
        MongoPolicy
    >;
};

export class AddRoleToPolicyTransaction extends PrimaryTransaction<
    AddRoleToPolicyTransactionInput,
    AddRoleToPolicyTransactionOutput
> {
    protected async executeSQL(
        data: AddRoleToPolicyTransactionInput[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<AddRoleToPolicyTransactionOutput[DatabaseConnectionType.SQL]> {
        let { createPolicyParams, policy, role } = data;
        if (!policy) {
            try {
                policy = queryRunner.manager.create(SqlPolicy, {
                    resource: createPolicyParams.resource,
                    action: createPolicyParams.action,
                });
                policy = await queryRunner.manager.save<SqlPolicy>(policy);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw err;
            }
        }

        role.policies?.forEach((rolePolicy: SqlPolicy) => {
            if (policy.id == rolePolicy.id) {
                const policyAlreadyAttachedOnRoleException: PolicyAlreadyAttachedOnRoleException<
                    SqlPolicy,
                    SqlRole
                > = new PolicyAlreadyAttachedOnRoleException(
                    policy.id,
                    role.id
                );
                this.logger.error(
                    `policy already exists on role`,
                    policyAlreadyAttachedOnRoleException
                );
                throw policyAlreadyAttachedOnRoleException;
            }
        });

        if (!role.policies?.length) {
            role.policies = [policy];
        } else {
            role.policies.push(policy);
        }

        try {
            role = await queryRunner.manager.save<SqlRole>(role);
        } catch (err) {
            this.logger.error("error updating role", err as Error);
            throw err;
        }

        // TODO: Make subjects unique
        let subjectsWithRoleKey: Array<Pick<SqlUserPoliciesDenorm, "subject">> =
            await queryRunner.manager.find(SqlUserPoliciesDenorm, {
                where: {
                    roleKey: role.name,
                },
                select: {
                    subject: true,
                },
            });
        const subjectMap: Set<string> = new Set();
        subjectsWithRoleKey = subjectsWithRoleKey.reduce(
            (
                agg: Array<Pick<SqlUserPoliciesDenorm, "subject">>,
                value: Pick<SqlUserPoliciesDenorm, "subject">
            ) => {
                const { subject } = value;
                if (subjectMap.has(subject)) {
                    return agg;
                }
                subjectMap.add(subject);
                return [...agg, { subject }];
            },
            []
        );
        const userPoliciesDenormToInsert: Array<SqlUserPoliciesDenorm> =
            subjectsWithRoleKey.map(
                (denormSubject: Pick<SqlUserPoliciesDenorm, "subject">) => {
                    return queryRunner.manager.create(SqlUserPoliciesDenorm, {
                        subject: denormSubject.subject,
                        roleKey: role.name,
                        policyMapKey: convertPolicyToPolicyMapKey(policy),
                    });
                }
            );
        if (userPoliciesDenormToInsert?.length) {
            try {
                await queryRunner.manager.save<SqlUserPoliciesDenorm>(
                    userPoliciesDenormToInsert
                );
            } catch (err) {
                this.logger.error(
                    "error on updating user policies denorm",
                    err as Error
                );
                throw err;
            }
        }

        return { role, policy };
    }

    protected async executeMongo(
        data: AddRoleToPolicyTransactionInput[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner
    ): Promise<AddRoleToPolicyTransactionOutput[DatabaseConnectionType.MONGO]> {
        let { createPolicyParams, policy, role } = data;
        if (!policy) {
            try {
                policy = queryRunner.manager.create(MongoPolicy, {
                    resource: createPolicyParams.resource,
                    action: createPolicyParams.action,
                });
                policy = await queryRunner.manager.save<MongoPolicy>(policy);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw err;
            }
        }
        if (!role?.policies) {
            role.policies = [];
        }

        (role.policies as ObjectId[]).forEach((policyId: ObjectId) => {
            if (policy.id.toString() === policyId.toString()) {
                const policyAlreadyAttachedOnRoleException: PolicyAlreadyAttachedOnRoleException<
                    MongoPolicy,
                    MongoRole
                > = new PolicyAlreadyAttachedOnRoleException(
                    policy.id,
                    role.id
                );
                this.logger.error(
                    "policy already attached",
                    policyAlreadyAttachedOnRoleException
                );
            }
        });

        role.policies.push(policy.id);

        try {
            queryRunner.manager.save(MongoRole, role);
        } catch (err) {
            this.logger.error("error saving role", err as Error);
            throw err;
        }

        const userPoliciesDenorm: Array<
            Pick<MongoUserPoliciesDenorm, "subject">
        > = await queryRunner.manager.find(MongoUserPoliciesDenorm, {
            where: {
                roleKey: role.name,
            },
            select: {
                subject: true,
            },
        });

        const subjectSet: Set<string> = new Set(
            userPoliciesDenorm.map(({ subject }) => subject)
        );

        const userPoliciesToBeInserted: Array<MongoUserPoliciesDenorm> = [];
        subjectSet.forEach((subject: string) => {
            userPoliciesToBeInserted.push(
                queryRunner.manager.create(MongoUserPoliciesDenorm, {
                    roleKey: role.name,
                    subject,
                    policyMapKey:
                        convertPolicyToPolicyMapKey<MongoPolicy>(policy),
                })
            );
        });

        const insertionChunks: Array<Array<MongoUserPoliciesDenorm>> = chunk(
            userPoliciesToBeInserted,
            1000
        );
        try {
            for (let chunk of insertionChunks) {
                await queryRunner.manager.insert<MongoUserPoliciesDenorm>(
                    MongoUserPoliciesDenorm,
                    chunk
                );
            }
        } catch (err) {
            this.logger.error("error inserting chunk", err as Error);
            throw new InternalServerError(err);
        }

        return {
            role,
            policy,
        };
    }
}
