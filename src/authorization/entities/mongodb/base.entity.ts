import {
    BaseEntity,
    Column,
    Entity,
    ObjectId,
    ObjectIdColumn,
    PrimaryColumn,
} from "typeorm";

@Entity()
export class MongoBaseEntity extends BaseEntity {
    @ObjectIdColumn()
    id: ObjectId;
}
