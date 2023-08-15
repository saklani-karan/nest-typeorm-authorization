import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { DatabaseEntity } from "../services/abac.interface";

export class PolicyNotAttachedOnUserException<
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
            `policy with policyId=${policyId} does not exist on user with id=${userId}`,
            HttpStatus.NOT_FOUND
        );
    }
}
