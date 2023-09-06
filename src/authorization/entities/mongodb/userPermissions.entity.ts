import {
    BaseEntity,
    Column,
    Entity,
    ObjectId,
    ObjectIdColumn,
    PrimaryColumn,
} from "typeorm";
import { MongoBaseEntity } from "./base.entity";

@Entity()
export class UserPermissions extends MongoBaseEntity {
    @Column({ type: "string" })
    subject: string;

    @Column({ type: "array" })
    roles: Array<ObjectId>;

    @Column({ type: "array" })
    policies: Array<ObjectId>;
}
