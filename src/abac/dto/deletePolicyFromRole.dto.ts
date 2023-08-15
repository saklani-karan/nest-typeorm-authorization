import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";

export class RemovePolicyFromRoleParams {
    policyId: Policy["id"];
    roleId: Role["id"];
    resource: Policy["resource"];
    action: Policy["action"];
}

export class RemovePolicyFromRoleResponse {
    role: Role;
    policy: Policy;
}
