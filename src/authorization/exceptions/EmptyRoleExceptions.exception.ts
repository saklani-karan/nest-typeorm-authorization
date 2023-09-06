import { HttpException, HttpStatus } from "@nestjs/common";
import { Role as SqlRole } from "../entities/sql";
import { Role as MongoRole } from "../entities/mongodb";

export class EmptyRoleException<
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor({ roleId }: { roleId: IRole["id"] }) {
        super(
            `role with roleId=${roleId} has no policies attached`,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}

export class RoleCannotBeEmptyException<
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor({ roleId }: { roleId: IRole["id"] }) {
        super(
            `role with roleId=${roleId} cannot be empty, deletion of policy would make the role empty`,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}
