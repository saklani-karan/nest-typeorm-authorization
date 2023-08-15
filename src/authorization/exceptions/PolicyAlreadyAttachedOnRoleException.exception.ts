import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";

export class PolicyAlreadyAttachedOnRoleException extends HttpException {
    constructor({
        policyId,
        roleId,
    }: {
        policyId: Policy["id"];
        roleId: Role["id"];
    }) {
        super(
            `policy with policyId=${policyId} and role with roleId=${roleId}`,
            HttpStatus.CONFLICT
        );
    }
}
