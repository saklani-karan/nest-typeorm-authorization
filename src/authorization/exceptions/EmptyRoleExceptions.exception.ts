import { HttpException, HttpStatus } from "@nestjs/common";
import { Role } from "../entities/postgres/role.entity";

export class EmptyRoleException extends HttpException {
    constructor({ roleId }: { roleId: Role["id"] }) {
        super(
            `role with roleId=${roleId} has no policies attached`,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}

export class RoleCannotBeEmptyException extends HttpException {
    constructor({ roleId }: { roleId: Role["id"] }) {
        super(
            `role with roleId=${roleId} cannot be empty, deletion of policy would make the role empty`,
            HttpStatus.FAILED_DEPENDENCY
        );
    }
}
