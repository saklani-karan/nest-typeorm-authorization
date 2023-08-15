import {
    BaseEntity,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Policy } from "./policy.entity";

@Entity("user_policies_denorm")
export class UserPoliciesDenorm extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", name: "subject" })
    subject: string;

    @Column({ type: "varchar", name: "policy_map_key" })
    policyMapKey: string;

    @Column({ type: "varchar", name: "role_key", nullable: true })
    roleKey?: string;
}
