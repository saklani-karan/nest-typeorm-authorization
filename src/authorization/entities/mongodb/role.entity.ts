import {
    BaseEntity,
    Column,
    Entity,
    ObjectId,
    ObjectIdColumn,
    PrimaryColumn,
} from "typeorm";
import { MongoBaseEntity } from "./base.entity";
import { Policy } from "./policy.entity";

@Entity()
export class Role extends MongoBaseEntity {
    @Column({ type: "string", nullable: false })
    name: string;

    @Column({ type: "array" })
    policies: Array<ObjectId | Policy>;
}
