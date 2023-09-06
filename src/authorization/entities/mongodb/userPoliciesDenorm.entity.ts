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
export class UserPoliciesDenorm extends MongoBaseEntity {
    @Column({ type: "string" })
    subject: string;

    @Column({ type: "string" })
    policyMapKey: string;

    @Column({ type: "string", nullable: true })
    roleKey?: string;
}
