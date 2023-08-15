import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { Role } from "../entities/postgres/role.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { DatabaseEntity } from "../services/abac.interface";

export class RemoveRoleFromUserTransactionParams<
    UserEntity extends DatabaseEntity
> {
    role: Role;
    user: UserEntity;
    subject: string;
    userPermissions: UserPermissions;
}

export class RemoveRoleFromUserTransactionResponse {
    success: boolean;
}

export class RemoveRoleFromUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemoveRoleFromUserTransactionParams<UserEntity>,
    RemoveRoleFromUserTransactionResponse
> {
    protected async execute(
        data: RemoveRoleFromUserTransactionParams<UserEntity>,
        queryRunner: QueryRunner
    ): Promise<RemoveRoleFromUserTransactionResponse> {
        const { role, subject, userPermissions } = data;

        try {
            await queryRunner.manager.query<Number>(
                `DELETE FROM user_permission_roles WHERE user_id=$1 AND role_id=$2`,
                [userPermissions.id, role.id]
            );
        } catch (err) {
            this.logger.error("error deleting role", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(UserPoliciesDenorm, {
                subject,
                roleKey: role.name,
            });
        } catch (err) {
            this.logger.error("error deleting denorm policies", err as Error);
            throw err;
        }

        return { success: true };
    }
}
