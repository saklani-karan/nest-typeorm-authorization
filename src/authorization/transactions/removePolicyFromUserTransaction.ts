import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import {
    Policy as SqlPolicy,
    UserPermissions as SqlUserPermissions,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Policy as MongoPolicy,
    UserPermissions as MongoUserPermissions,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import {
    DatabaseConnectionType,
    DatabaseEntity,
} from "../services/authorization.interface";
import { ObjectId } from "mongodb";
import { InternalServerError } from "../exceptions/InternalServerError.exception";

export type IRemovePolicyFromUserTransactionParams<
    IPolicy extends SqlPolicy | MongoPolicy,
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions,
    UserEntity extends DatabaseEntity
> = {
    policy: IPolicy;
    user: UserEntity;
    subject: string;
    userPermissions: IUserPermissions;
};

export type IRemovePolicyFromUserTransactionOutput = {
    success: boolean;
};

export type RemovePolicyFromUserTransactionInput<
    UserEntity extends DatabaseEntity
> = {
    [DatabaseConnectionType.MONGO]: IRemovePolicyFromUserTransactionParams<
        MongoPolicy,
        MongoUserPermissions,
        UserEntity
    >;
    [DatabaseConnectionType.SQL]: IRemovePolicyFromUserTransactionParams<
        SqlPolicy,
        SqlUserPermissions,
        UserEntity
    >;
};

export type RemovePolicyFromUserTransactionOutput = {
    [DatabaseConnectionType.MONGO]: IRemovePolicyFromUserTransactionOutput;
    [DatabaseConnectionType.SQL]: IRemovePolicyFromUserTransactionOutput;
};

export class RemovePolicyFromUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemovePolicyFromUserTransactionInput<UserEntity>,
    RemovePolicyFromUserTransactionOutput
> {
    protected async executeSQL(
        data: any,
        queryRunner: QueryRunner
    ): Promise<
        RemovePolicyFromUserTransactionOutput[DatabaseConnectionType.SQL]
    > {
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
            await queryRunner.manager.delete(SqlUserPoliciesDenorm, {
                subject,
                policyMapKey: convertPolicyToPolicyMapKey(policy),
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }

    protected async executeMongo(
        data: IRemovePolicyFromUserTransactionParams<
            MongoPolicy,
            MongoUserPermissions,
            UserEntity
        >,
        queryRunner: QueryRunner
    ): Promise<IRemovePolicyFromUserTransactionOutput> {
        const { policy, user, subject, userPermissions } = data;

        userPermissions.policies = userPermissions.policies.filter(
            (policyId: ObjectId) => {
                return policyId.toString() !== policy.id.toString();
            }
        );

        try {
            await queryRunner.manager.save(
                MongoUserPermissions,
                userPermissions
            );
        } catch (err) {
            this.logger.error("error saving user permissions", err as Error);
            throw new InternalServerError(err);
        }

        try {
            await queryRunner.manager.delete(MongoUserPoliciesDenorm, {
                subject,
                policyMapKey: convertPolicyToPolicyMapKey<MongoPolicy>(policy),
            });
        } catch (err) {
            this.logger.error("error updating mongo user policies denrom");
            throw new InternalServerError(err);
        }

        return { success: true };
    }
}
