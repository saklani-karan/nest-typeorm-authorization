import { Role } from "../entities/postgres/role.entity";

export class RemoveRoleParams {
    roleId: Role["id"];
    forceRemove: boolean;
}

export class RemoveRoleResponse {
    role: Role;
    usersAffected: number = 0;
}
