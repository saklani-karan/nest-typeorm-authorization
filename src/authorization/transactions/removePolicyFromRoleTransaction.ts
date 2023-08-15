import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";

export type RemovePolicyFromRoleTransactionParams = {
    policy: Policy;
    role: Role;
};

export type RemovePolicyFromRoleTransactionOutput = {
    success: boolean;
};

export class RemovePolicyFromRoleTransaction extends PrimaryTransaction<
    RemovePolicyFromRoleTransactionParams,
    RemovePolicyFromRoleTransactionOutput
> {
    protected async execute(
        data: RemovePolicyFromRoleTransactionParams,
        queryRunner: QueryRunner
    ): Promise<RemovePolicyFromRoleTransactionOutput> {
        const { policy, role } = data;

        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM role_policies WHERE role_id=$1 AND policy_id=$2`,
                [role.id, policy.id]
            );
        } catch (err) {
            this.logger.error("error deleting policy", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(UserPoliciesDenorm, {
                roleKey: role.name,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }
}
