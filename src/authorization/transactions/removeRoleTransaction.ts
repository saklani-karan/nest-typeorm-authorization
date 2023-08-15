import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { Role } from "../entities/postgres/role.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";

export type RemoveRoleTransactionParams = {
    role: Role;
};

export type RemoveRoleTransactionResponse = {
    success: boolean;
};

export class RemoveRoleTransaction extends PrimaryTransaction<
    RemoveRoleTransactionParams,
    RemoveRoleTransactionResponse
> {
    protected async execute(
        data: RemoveRoleTransactionParams,
        queryRunner: QueryRunner
    ): Promise<RemoveRoleTransactionResponse> {
        const { role } = data;
        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM user_permission_roles WHERE role_id=$1`,
                [role.id]
            );
        } catch (err) {
            this.logger.error(
                "error deleting role from user permissions",
                err as Error
            );
            throw err;
        }

        try {
            await queryRunner.manager.delete(UserPoliciesDenorm, {
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.remove<Role>(role);
        } catch (err) {
            this.logger.error("error deleting role", err as Error);
            throw err;
        }

        return { success: true };
    }
}
