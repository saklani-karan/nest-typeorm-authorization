import { Role as SqlRole } from "../entities/sql/role.entity";
import { Role as MongoRole } from "../entities/mongodb/role.entity";
export class RemoveRoleParams<IRole extends SqlRole | MongoRole> {
    roleId: IRole["id"];
    forceRemove: boolean;
}

export class RemoveRoleResponse<IRole extends SqlRole | MongoRole> {
    role: IRole;
    usersAffected: number = 0;
}
