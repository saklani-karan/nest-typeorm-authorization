import { HttpException, HttpStatus } from "@nestjs/common";
import { DeepPartial } from "typeorm";
import { Policy } from "../entities/postgres/policy.entity";

export class PolicyExistsException extends HttpException {
    constructor({ resource, action }: DeepPartial<Policy>) {
        super(
            `policy with resource '${resource}' and action '${action}' already exists`,
            HttpStatus.CONFLICT
        );
    }
}
