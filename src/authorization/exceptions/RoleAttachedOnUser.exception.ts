import { HttpException, HttpStatus } from "@nestjs/common";
import { Role as SqlRole } from "../entities/sql";
import { Role as MongoRole } from "../entities/mongodb";
export class RoleAttachedOnUsersException<
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor({
        roleId,
        userCount,
    }: {
        roleId: IRole["id"];
        userCount: number;
    }) {
        super(
            `role with roleId=${roleId} has ${userCount} users attached`,
            HttpStatus.CONFLICT
        );
    }
}
