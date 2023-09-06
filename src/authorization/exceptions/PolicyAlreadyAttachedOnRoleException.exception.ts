import { HttpException, HttpStatus } from "@nestjs/common";
import { Role as SqlRole, Policy as SqlPolicy } from "../entities/sql";
import { Role as MongoRole, Policy as MongoPolicy } from "../entities/mongodb";

export class PolicyAlreadyAttachedOnRoleException<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor(policyId: IPolicy["id"], roleId: IRole["id"]) {
        super(
            `policy with policyId=${policyId} and role with roleId=${roleId}`,
            HttpStatus.CONFLICT
        );
    }
}
