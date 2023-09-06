import {
    BaseEntity,
    Column,
    Entity,
    ObjectId,
    ObjectIdColumn,
    PrimaryGeneratedColumn,
    Table,
} from "typeorm";
import { SqlBaseEntity } from "./base.entity";

@Entity("policies")
export class Policy extends SqlBaseEntity {
    @Column()
    resource: string;

    @Column()
    action: string;
}
