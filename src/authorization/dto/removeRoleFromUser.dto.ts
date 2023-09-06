import { BaseEntity } from "typeorm";
import { Role as SqlRole } from "../entities/sql/role.entity";
import { Role as MongoRole } from "../entities/mongodb/role.entity";
import { DatabaseEntity } from "../services/authorization.interface";

export class RemoveRoleFromUserParams<
    UserEntity extends DatabaseEntity,
    IRole extends SqlRole | MongoRole
> {
    roleId: IRole["id"];
    userId: UserEntity["id"];
}

export class RemoveRoleFromUserResponse {
    success: boolean;
}
