import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";
import { DatabaseEntity } from "../services/abac.interface";

export class PolicyAlreadyAttachedOnUserException<
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor({
        policyId,
        userId,
    }: {
        policyId: Policy["id"];
        userId: UserEntity["id"];
    }) {
        super(
            `policy with id=${policyId} already exists on user with id=${userId}`,
            HttpStatus.CONFLICT
        );
    }
}
