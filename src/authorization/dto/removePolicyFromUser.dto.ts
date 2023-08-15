import { Policy } from "../entities/postgres/policy.entity";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { DatabaseEntity } from "../services/authorization.interface";

export class RemovePolicyFromUserParams<UserEntity extends DatabaseEntity> {
    userId: UserEntity["id"];
    policyId: Policy["id"];
}

export class RemovePolicyFromUserResponse {
    success: boolean;
}
