import { HttpException, HttpStatus } from "@nestjs/common";
import { Role } from "../entities/postgres/role.entity";
import { DatabaseEntity } from "../services/abac.interface";

export class RoleNotAttachedOnUserException<
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor({
        roleId,
        userId,
    }: {
        roleId: Role["id"];
        userId: UserEntity["id"];
    }) {
        super(
            `user with userId=${userId} does not have the role with roleId=${roleId} `,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}
