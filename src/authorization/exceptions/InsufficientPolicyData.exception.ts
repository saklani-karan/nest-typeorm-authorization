import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy as SqlPolicy } from "../entities/sql";
import { Policy as MongoPolicy } from "../entities/mongodb";

export class InsufficientPolicyDataException extends HttpException {
    constructor() {
        super(
            "Insufficient policy data provided for creation or finding policy",
            HttpStatus.BAD_REQUEST
        );
    }
}

export class ConflicitingPolicyDataException<
    IPolicy extends SqlPolicy | MongoPolicy
> extends HttpException {
    constructor(queriedPolicy: IPolicy, idPolicy: IPolicy) {
        super(
            `policy queried by id ${idPolicy.id} and policy queried by creation request ${queriedPolicy.id} are different`,
            HttpStatus.CONFLICT
        );
    }
}
