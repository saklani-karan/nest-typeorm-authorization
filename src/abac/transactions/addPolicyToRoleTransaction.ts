import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { PolicyAlreadyAttachedOnRoleException } from "../exceptions/PolicyAlreadyAttachedOnRoleException.exception";

export type CreatePolicyTransactionParams = {
    resource: string;
    action: string;
};

export type AddRoleToPolicyTransactionInput = {
    createPolicyParams?: CreatePolicyTransactionParams;
    policy?: Policy;
    role: Role;
};

export type AddRoleToPolicyTransactionOutput = {
    role: Role;
    policy: Policy;
};

export class AddRoleToPolicyTransaction extends PrimaryTransaction<
    AddRoleToPolicyTransactionInput,
    AddRoleToPolicyTransactionOutput
> {
    protected async execute(
        data: AddRoleToPolicyTransactionInput,
        queryRunner: QueryRunner
    ): Promise<AddRoleToPolicyTransactionOutput> {
        let { createPolicyParams, policy, role } = data;
        if (!policy) {
            try {
                policy = queryRunner.manager.create(Policy, {
                    resource: createPolicyParams.resource,
                    action: createPolicyParams.action,
                });
                policy = await queryRunner.manager.save<Policy>(policy);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw err;
            }
        }

        role.policies?.forEach((rolePolicy: Policy) => {
            if (policy.id == rolePolicy.id) {
                const policyAlreadyAttachedOnRoleException: PolicyAlreadyAttachedOnRoleException =
                    new PolicyAlreadyAttachedOnRoleException({
                        policyId: policy.id,
                        roleId: role.id,
                    });
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
            role = await queryRunner.manager.save<Role>(role);
        } catch (err) {
            this.logger.error("error updating role", err as Error);
            throw err;
        }

        // TODO: Make subjects unique
        let subjectsWithRoleKey: Array<Pick<UserPoliciesDenorm, "subject">> =
            await queryRunner.manager.find(UserPoliciesDenorm, {
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
                agg: Array<Pick<UserPoliciesDenorm, "subject">>,
                value: Pick<UserPoliciesDenorm, "subject">
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
        const userPoliciesDenormToInsert: Array<UserPoliciesDenorm> =
            subjectsWithRoleKey.map(
                (denormSubject: Pick<UserPoliciesDenorm, "subject">) => {
                    return queryRunner.manager.create(UserPoliciesDenorm, {
                        subject: denormSubject.subject,
                        roleKey: role.name,
                        policyMapKey: convertPolicyToPolicyMapKey(policy),
                    });
                }
            );
        if (userPoliciesDenormToInsert?.length) {
            try {
                await queryRunner.manager.save<UserPoliciesDenorm>(
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
}
