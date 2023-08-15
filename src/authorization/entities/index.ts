import { DataSourceOptions, EntitySchema } from "typeorm";
import { Policy } from "./postgres/policy.entity";
import { Role } from "./postgres/role.entity";
import { UserPermissions } from "./postgres/userPermissions.entity";
import { UserPoliciesDenorm } from "./postgres/userPoliciesDenorm.entity";

export function getEntities(
    type: DataSourceOptions["type"]
): Array<string | Function | EntitySchema<any>> {
    if (type === "postgres") {
        return [Policy, Role, UserPermissions, UserPoliciesDenorm];
    }
    throw new Error(`Database ${type} not supported`);
}
