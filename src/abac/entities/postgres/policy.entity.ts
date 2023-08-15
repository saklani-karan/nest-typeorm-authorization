import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("policies")
export class Policy extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    resource: string;

    @Column()
    action: string;
}
