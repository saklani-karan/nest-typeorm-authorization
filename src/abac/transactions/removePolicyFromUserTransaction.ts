import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { Policy } from "../entities/postgres/policy.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { DatabaseEntity } from "../services/abac.interface";

export type RemovePolicyFromUserTransactionParams<
    UserEntity extends DatabaseEntity
> = {
    policy: Policy;
    user: UserEntity;
    subject: string;
    userPermissions: UserPermissions;
};

export type RemovePolicyFromUserTransactionResponse = {
    success: boolean;
};

export class RemovePolicyFromUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemovePolicyFromUserTransactionParams<UserEntity>,
    RemovePolicyFromUserTransactionResponse
> {
    protected async execute(
        data: any,
        queryRunner: QueryRunner
    ): Promise<RemovePolicyFromUserTransactionResponse> {
        const { policy, user, subject, userPermissions } = data;

        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM user_permission_policies WHERE user_id=$1 AND policy_id=$2`,
                [userPermissions.id, policy.id]
            );
        } catch (err) {
            this.logger.error("error deleting policy", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(UserPoliciesDenorm, {
                subject,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }
}
