import {
    Policy as SqlPolicy,
    UserPermissions as SqlUserPermissions,
} from "../entities/sql";
import {
    Policy as MongoPolicy,
    UserPermissions as MongoUserPermissions,
} from "../entities/mongodb";
import { DatabaseEntity } from "../services/authorization.interface";

export class AttachPolicyToUserParams<
    IPolicy extends SqlPolicy | MongoPolicy,
    UserEntity extends DatabaseEntity
> {
    policyId: IPolicy["id"];
    action: IPolicy["action"];
    resource: IPolicy["resource"];
    userId: UserEntity["id"];
}

export class AttachPolicyToUserResponse<
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions
> {
    userPermissions: IUserPermissions;
}
