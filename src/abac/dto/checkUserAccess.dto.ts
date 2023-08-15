import { DatabaseEntity } from "../services/abac.interface";

export type Permission = {
    resource: string;
    action: string;
};

export class CheckUserAccessRequest<UserEntity extends DatabaseEntity> {
    subject?: string;
    id?: UserEntity["id"];
    permissions: Array<Permission>;
}
