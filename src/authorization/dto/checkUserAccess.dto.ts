import { DatabaseEntity } from "../services/authorization.interface";

export type Permission = {
    resource: string;
    action: string;
};

export class CheckUserAccessRequest<UserEntity extends DatabaseEntity> {
    subject?: string;
    id?: UserEntity["id"];
    permissions: Array<Permission>;
}
