import { QueryRunner } from "typeorm";
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
import { DatabaseConnectionType } from "../services/authorization.interface";

export type IRemovePolicyFromRoleTransactionInput<IPolicy, IRole> = {
    policy: IPolicy;
    role: IRole;
};

export type IRemovePolicyFromRoleTransactionOutput = {
    success: boolean;
};

export type RemovePolicyFromRoleTransactionInput = {
    [DatabaseConnectionType.SQL]: IRemovePolicyFromRoleTransactionInput<
        SqlPolicy,
        SqlRole
    >;
    [DatabaseConnectionType.MONGO]: IRemovePolicyFromRoleTransactionInput<
        MongoPolicy,
        MongoRole
    >;
};

export type RemovePolicyFromRoleTransactionOutput = {
    [DatabaseConnectionType.SQL]: IRemovePolicyFromRoleTransactionOutput;
    [DatabaseConnectionType.MONGO]: IRemovePolicyFromRoleTransactionOutput;
};
export class RemovePolicyFromRoleTransaction extends PrimaryTransaction<
    RemovePolicyFromRoleTransactionInput,
    RemovePolicyFromRoleTransactionOutput
> {
    protected async executeSQL(
        data: RemovePolicyFromRoleTransactionInput[DatabaseConnectionType.SQL],
        queryRunner: QueryRunner
    ): Promise<
        RemovePolicyFromRoleTransactionOutput[DatabaseConnectionType.SQL]
    > {
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
            await queryRunner.manager.delete(SqlUserPoliciesDenorm, {
                roleKey: role.name,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }

    protected async executeMongo(
        data: RemovePolicyFromRoleTransactionInput[DatabaseConnectionType.MONGO],
        queryRunner: QueryRunner
    ): Promise<
        RemovePolicyFromRoleTransactionOutput[DatabaseConnectionType.MONGO]
    > {
        let { role, policy } = data;
        role.policies = role.policies.filter(
            (policyId) => policyId != policy.id
        );

        try {
            await queryRunner.manager.save(MongoRole, role);
        } catch (err) {
            this.logger.error("error on updating role", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error on deleting mongo user policies denorm");
            throw err;
        }

        return { success: true };
    }
}
