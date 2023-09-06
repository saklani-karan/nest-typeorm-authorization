import { BaseEntity, PrimaryGeneratedColumn } from "typeorm";

export class SqlBaseEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
}
