import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy as SqlPolicy } from "../entities/sql";
import { Policy as MongoPolicy } from "../entities/mongodb";
import { DatabaseEntity } from "../services/authorization.interface";

export class PolicyNotAttachedOnUserException<
    IPolicy extends SqlPolicy | MongoPolicy,
    UserEntity extends DatabaseEntity
> extends HttpException {
    constructor({
        policyId,
        userId,
    }: {
        policyId: IPolicy["id"];
        userId: UserEntity["id"];
    }) {
        super(
            `policy with policyId=${policyId} does not exist on user with id=${userId}`,
            HttpStatus.NOT_FOUND
        );
    }
}
