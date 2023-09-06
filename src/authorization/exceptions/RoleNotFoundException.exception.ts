import { HttpException, HttpStatus } from "@nestjs/common";
import { Role as SqlRole } from "../entities/sql";
import { Role as MongoRole } from "../entities/mongodb";

export class RoleNotFoundException<
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor({ id }: { id: IRole["id"] }) {
        super(`role not found with id =${id}`, HttpStatus.NOT_FOUND);
    }
}
