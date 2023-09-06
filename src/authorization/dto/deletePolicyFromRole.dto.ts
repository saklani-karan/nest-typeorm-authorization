import { Policy as SqlPolicy, Role as SqlRole } from "../entities/sql";
import { Policy as MongoPolicy, Role as MongoRole } from "../entities/mongodb";

export class RemovePolicyFromRoleParams<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> {
    policyId: IPolicy["id"];
    roleId: IRole["id"];
    resource: IPolicy["resource"];
    action: IPolicy["action"];
}

export class RemovePolicyFromRoleResponse<
    IPolicy extends SqlPolicy | MongoPolicy,
    IRole extends SqlRole | MongoRole
> {
    role: IRole;
    policy: IPolicy;
}
