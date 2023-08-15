import { HttpException, HttpStatus } from "@nestjs/common";
import { DatabaseEntity } from "../services/authorization.interface";

export class UserNotFoundException<
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor({ id }: { id: UserEntity["id"] }) {
        super(`user not found with id =${id}`, HttpStatus.NOT_FOUND);
    }
}
