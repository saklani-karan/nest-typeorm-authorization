import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { DatabaseEntity } from "../services/authorization.interface";

export class AttachPolicyToUserParams<UserEntity extends DatabaseEntity> {
    policyId: Policy["id"];
    action: string;
    resource: string;
    userId: UserEntity["id"];
}

export class AttachPolicyToUserResponse<UserEntity extends DatabaseEntity> {
    userPermissions: UserPermissions;
}
