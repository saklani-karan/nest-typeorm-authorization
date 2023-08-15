import { DatabaseEntity } from "../services/abac.interface";

export class RemoveUserResponse<UserEntity extends DatabaseEntity> {
    user: UserEntity;
    success: boolean;
}

export class RemoveUserParams {
    deleteUser: boolean;
}
