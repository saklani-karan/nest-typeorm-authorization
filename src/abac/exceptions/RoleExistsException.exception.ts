import { HttpException, HttpStatus } from "@nestjs/common";
import { type } from "os";

export type RoleAlreadyExistsExceptionConstructorParams = {
    role: string;
};

export type RoleAlreadyExistsOnUserExceptionConstructorParams = {
    role: string;
    user: string;
};

export class RoleAlreadyExistsException extends HttpException {
    constructor(params: RoleAlreadyExistsExceptionConstructorParams) {
        super(`role ${params.role} already exists`, HttpStatus.CONFLICT);
    }
}

export class RoleAlreadyExistsOnUserException extends HttpException {
    constructor(params: RoleAlreadyExistsOnUserExceptionConstructorParams) {
        super(
            `rrole ${params.role} already exists on user ${params.user}`,
            HttpStatus.CONFLICT
        );
    }
}
