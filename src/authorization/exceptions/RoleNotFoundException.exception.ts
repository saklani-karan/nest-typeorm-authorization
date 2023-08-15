import { HttpException, HttpStatus } from "@nestjs/common";
import { Role } from "../entities/postgres/role.entity";

export class RoleNotFoundException extends HttpException {
    constructor({ id }: { id: Role["id"] }) {
        super(`role not found with id =${id}`, HttpStatus.NOT_FOUND);
    }
}
