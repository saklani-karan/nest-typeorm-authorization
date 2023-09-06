import { DataSourceOptions, EntitySchema } from "typeorm";
import { getMongoEntities } from "./mongodb";
import { getSQLEntities } from "./sql";

export function getEntities(
    type: DataSourceOptions["type"]
): Array<string | Function | EntitySchema<any>> {
    if (
        type === "postgres" ||
        type === "sqlite" ||
        type === "mysql" ||
        type === "sqljs" ||
        type === "better-sqlite3"
    ) {
        return getSQLEntities();
    } else if (type === "mongodb") {
        return getMongoEntities();
    }
    throw new Error(`Database ${type} not supported`);
}
