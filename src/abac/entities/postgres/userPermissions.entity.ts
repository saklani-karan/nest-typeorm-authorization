import {
    BaseEntity,
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Policy } from "./policy.entity";
import { Role } from "./role.entity";

@Entity("user_permissions")
export class UserPermissions extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: "subject", type: "varchar" })
    subject: string;

    @ManyToMany(() => Role)
    @JoinTable({
        name: "user_permission_roles",
        joinColumn: { name: "user_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "role_id", referencedColumnName: "id" },
    })
    roles: Role[];

    @ManyToMany(() => Policy)
    @JoinTable({
        name: "user_permission_policies",
        joinColumn: { name: "user_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "policy_id", referencedColumnName: "id" },
    })
    policies: Policy[];
}
