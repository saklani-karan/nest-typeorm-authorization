import { DatabaseEntity } from "../services/authorization.interface";

export class RemoveUserResponse<UserEntity extends DatabaseEntity> {
    user: UserEntity;
    success: boolean;
}

export class RemoveUserParams {
    deleteUser: boolean;
}
