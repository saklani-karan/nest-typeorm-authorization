import { Role } from "../entities/postgres/role.entity";
import { DatabaseEntity } from "../services/authorization.interface";

export class RemoveRoleFromUserParams<UserEntity extends DatabaseEntity> {
    roleId: Role["id"];
    userId: UserEntity["id"];
}

export class RemoveRoleFromUserResponse {
    success: boolean;
}
