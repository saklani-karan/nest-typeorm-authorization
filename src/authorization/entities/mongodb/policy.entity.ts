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
export class Policy extends MongoBaseEntity {
    @Column({ type: "string" })
    resource: string;

    @Column({ type: "string" })
    action: string;
}
