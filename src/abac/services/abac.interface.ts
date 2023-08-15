import { ModuleMetadata, Type } from "@nestjs/common";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";

export interface DatabaseEntity {
    id: any;
}

export interface AuthorizationModuleOptions<UserEntity extends DatabaseEntity> {
    databaseConnectionOptions: DataSourceOptions;
    userEntity: any;
    subjectKey: keyof UserEntity;
}

export interface AuthorizationModuleFactory<UserEntity extends DatabaseEntity> {
    createAuthorizationModuleOptions: () =>
        | Promise<AuthorizationModuleOptions<UserEntity>>
        | AuthorizationModuleOptions<UserEntity>;
}

export interface AuthorizationModuleAsyncOptions<
    UserEntity extends DatabaseEntity
> extends Pick<ModuleMetadata, "imports"> {
    inject?: any[];
    useClass?: Type<AuthorizationModuleFactory<UserEntity>>;
    useExisting?: Type<AuthorizationModuleFactory<UserEntity>>;
    useFactory?: (
        ...args: any[]
    ) =>
        | Promise<AuthorizationModuleOptions<UserEntity>>
        | AuthorizationModuleOptions<UserEntity>; // dependencies of imports to be injected with the class
}
