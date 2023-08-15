import { DeepPartial, QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { Policy } from "../entities/postgres/policy.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { DatabaseEntity } from "../services/authorization.interface";

export type AddPolicyToUserTransactionParams<
    UserEntity extends DatabaseEntity
> = {
    subject: string;
    policy: Policy;
    user: UserEntity;
    policyCreationRequest: {
        resource: string;
        action: string;
    };
    userPermissions: UserPermissions;
};

export type AddPolicyToUserTransactionResponse<
    UserEntity extends DatabaseEntity
> = {
    userPermissions: UserPermissions;
};

export class AddPolicyToUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    AddPolicyToUserTransactionParams<UserEntity>,
    AddPolicyToUserTransactionResponse<UserEntity>
> {
    protected async execute(
        data: AddPolicyToUserTransactionParams<UserEntity>,
        queryRunner: QueryRunner
    ): Promise<AddPolicyToUserTransactionResponse<UserEntity>> {
        const { user, subject, policyCreationRequest } = data;
        let { policy } = data;
        let { userPermissions } = data;
        if (!userPermissions) {
            const userPermissionsDao: UserPermissions =
                queryRunner.manager.create(UserPermissions, {
                    subject,
                    policies: [],
                    roles: [],
                });
            userPermissions = await queryRunner.manager.save(
                UserPermissions,
                userPermissionsDao
            );
        }

        if (!policy) {
            try {
                const policyDao: Policy = queryRunner.manager.create(Policy, {
                    action: policyCreationRequest?.action,
                    resource: policyCreationRequest?.resource,
                });
                policy = await queryRunner.manager.save(Policy, policyDao);
            } catch (err) {
                this.logger.error("error creating policy", err as Error);
                throw err;
            }
        }
        if (!userPermissions?.policies?.length) {
            userPermissions.policies = [policy];
        }

        try {
            await queryRunner.manager.save(UserPermissions, userPermissions);
        } catch (err) {
            this.logger.error("error saving user permissions", err as Error);
            throw err;
        }

        const userPolicyDenormDao: UserPoliciesDenorm =
            queryRunner.manager.create(UserPoliciesDenorm, {
                subject,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        try {
            await queryRunner.manager.save(
                UserPoliciesDenorm,
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
}
