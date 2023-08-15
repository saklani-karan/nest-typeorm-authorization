import { HttpException, HttpStatus } from "@nestjs/common";
import { Role } from "../entities/postgres/role.entity";

export class RoleAttachedOnUsersException extends HttpException {
    constructor({
        roleId,
        userCount,
    }: {
        roleId: Role["id"];
        userCount: number;
    }) {
        super(
            `role with roleId=${roleId} has ${userCount} users attached`,
            HttpStatus.CONFLICT
        );
    }
}
