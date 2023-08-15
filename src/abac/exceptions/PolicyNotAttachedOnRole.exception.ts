import { HttpException, HttpStatus } from "@nestjs/common";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";

export class PolicyNotAttachedOnRoleException extends HttpException {
    constructor({
        policyId,
        roleId,
    }: {
        policyId: Policy["id"];
        roleId: Role["id"];
    }) {
        super(
            `policy with policyId=${policyId} does not exist on role with roleId=${roleId}`,
            HttpStatus.NOT_FOUND
        );
    }
}
