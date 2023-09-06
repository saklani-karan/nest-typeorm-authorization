import { EntitySchema } from "typeorm";
import { Policy } from "./policy.entity";
import { Role } from "./role.entity";
import { UserPermissions } from "./userPermissions.entity";
import { UserPoliciesDenorm } from "./userPoliciesDenorm.entity";

export function getSQLEntities(): Array<string | Function | EntitySchema<any>> {
    return [Policy, Role, UserPermissions, UserPoliciesDenorm];
}

export { Role } from "./role.entity";
export { Policy } from "./policy.entity";
export { UserPermissions } from "./userPermissions.entity";
export { UserPoliciesDenorm } from "./userPoliciesDenorm.entity";
export { SqlBaseEntity } from "./base.entity";
