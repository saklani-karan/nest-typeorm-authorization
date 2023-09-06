import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy as SqlPolicy, Role as SqlRole } from "../entities/sql";
import { Policy as MongoPolicy, Role as MongoRole } from "../entities/mongodb";

export class PolicyNotAttachedOnRoleException<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> extends HttpException {
    constructor({
        policyId,
        roleId,
    }: {
        policyId: IPolicy["id"];
        roleId: IRole["id"];
    }) {
        super(
            `policy with policyId=${policyId} does not exist on role with roleId=${roleId}`,
            HttpStatus.NOT_FOUND
        );
    }
}
