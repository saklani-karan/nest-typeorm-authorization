import { HttpException, HttpStatus } from "@nestjs/common";
import { DatabaseEntity } from "../services/authorization.interface";

export class SubjectCannotBeEmptyException<
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor(subjectKey: keyof UserEntity) {
        super(
            `Subject cannot be empty, received empty subject of subjectKey ${String(
                subjectKey
            )}`,
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
}
