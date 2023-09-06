import { Policy as SqlPolicy, Role as SqlRole } from "../entities/sql";
import { Policy as MongoPolicy, Role as MongoRole } from "../entities/mongodb";

export class AttachPolicyToRoleParams<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> {
    action: string;
    resource: string;
    policyId: IPolicy["id"];
    roleId: IRole["id"];
}

export class AttachPolicyToRoleResponse<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> {
    role: IRole;
    policy: IPolicy;
}
