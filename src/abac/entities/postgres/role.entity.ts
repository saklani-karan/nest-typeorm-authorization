import {
    BaseEntity,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Policy } from "./policy.entity";

@Entity("role")
export class Role extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "name" })
    name: string;

    @ManyToMany(() => Policy)
    @JoinTable({
        name: "role_policies",
        joinColumn: { name: "role_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "policy_id", referencedColumnName: "id" },
    })
    policies: Policy[];
}
