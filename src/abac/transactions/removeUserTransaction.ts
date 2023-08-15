import { QueryRunner } from "typeorm";
import { PrimaryTransaction } from "../../helpers/transaction";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { DatabaseEntity } from "../services/abac.interface";

export class RemoveUserTransactionParams<UserEntity extends DatabaseEntity> {
    user: UserEntity;
    subject: string;
    deleteUser: boolean = false;
}

export class RemoveUserTransactionResponse {
    success: boolean;
}

export class RemoveUserTransaction<
    UserEntity extends DatabaseEntity
> extends PrimaryTransaction<
    RemoveUserTransactionParams<UserEntity>,
    RemoveUserTransactionResponse
> {
    protected async execute(
        data: RemoveUserTransactionParams<UserEntity>,
        queryRunner: QueryRunner
    ): Promise<RemoveUserTransactionResponse> {
        const { user, subject, deleteUser } = data;

        try {
            await queryRunner.manager.delete(UserPermissions, { subject });
        } catch (err) {
            this.logger.error("error deleting user permissions", err as Error);
            throw err;
        }

        try {
            await queryRunner.manager.delete(UserPoliciesDenorm, { subject });
        } catch (err) {
            this.logger.error("error denorm policies from user", err as Error);
            throw err;
        }

        if (deleteUser) {
            try {
                await queryRunner.manager.remove<UserEntity>(user);
            } catch (err) {
                this.logger.error("error deleting user", err as Error);
                throw err;
            }
        }

        return {
            success: true,
        };
    }
}
