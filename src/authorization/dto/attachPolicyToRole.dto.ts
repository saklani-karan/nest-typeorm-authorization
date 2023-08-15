import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";

export class AttachPolicyToRoleParams {
    action: string;
    resource: string;
    policyId: Policy["id"];
    roleId: Role["id"];
}

export class AttachPolicyToRoleResponse {
    role: Role;
    policy: Policy;
}
