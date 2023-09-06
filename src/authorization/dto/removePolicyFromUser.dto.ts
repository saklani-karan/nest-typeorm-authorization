import { Policy as SqlPolicy } from "../entities/sql";
import { Policy as MongoPolicy } from "../entities/mongodb";
import { DatabaseEntity } from "../services/authorization.interface";

// TODO: Add resource action support
export class RemovePolicyFromUserParams<
    IPolicy extends SqlPolicy | MongoPolicy,
    UserEntity extends DatabaseEntity
> {
    userId: UserEntity["id"];
    policyId: IPolicy["id"];
}

export class RemovePolicyFromUserResponse {
    success: boolean;
}
