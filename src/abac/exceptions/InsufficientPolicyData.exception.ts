import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";

export class InsufficientPolicyDataException extends HttpException {
    constructor() {
        super(
            "Insufficient policy data provided for creation or finding policy",
            HttpStatus.BAD_REQUEST
        );
    }
}

export class ConflicitingPolicyDataException extends HttpException {
    constructor(queriedPolicy: Policy, idPolicy: Policy) {
        super(
            `policy queried by id ${idPolicy.id} and policy queried by creation request ${queriedPolicy.id} are different`,
            HttpStatus.CONFLICT
        );
    }
}
