import { HttpException, HttpStatus } from "@nestjs/common";
import { Role as SqlRole } from "../entities/sql";
import { Role as MongoRole } from "../entities/mongodb";
import { DatabaseEntity } from "../services/authorization.interface";

export class RoleNotAttachedOnUserException<
    IRole extends SqlRole | MongoRole,
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor({
        roleId,
        userId,
    }: {
        roleId: IRole["id"];
        userId: UserEntity["id"];
    }) {
        super(
            `user with userId=${userId} does not have the role with roleId=${roleId} `,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}
