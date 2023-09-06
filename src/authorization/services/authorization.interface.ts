import {
    Body,
    Delete,
    Get,
    ModuleMetadata,
    Param,
    Post,
    Query,
    Type,
} from "@nestjs/common";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import {
    DataSourceOptions,
    FindOptionsSelect,
    FindOptionsWhere,
    MongoRepository,
    Repository,
} from "typeorm";
import {
    Role as SqlRole,
    Policy as SqlPolicy,
    UserPermissions as SqlUserPermissions,
    UserPoliciesDenorm as SqlUserPoliciesDenorm,
} from "../entities/sql";
import {
    Role as MongoRole,
    Policy as MongoPolicy,
    UserPermissions as MongoUserPermissions,
    UserPoliciesDenorm as MongoUserPoliciesDenorm,
} from "../entities/mongodb";
import { CheckUserAccessRequest } from "../dto/checkUserAccess.dto";
import { RemoveUserParams, RemoveUserResponse } from "../dto/removeUser.dto";
import { AttachRoleToUserResponse } from "../dto/attachRoleToUser.dto";
import {
    RemoveRoleFromUserParams,
    RemoveRoleFromUserResponse,
} from "../dto/removeRoleFromUser.dto";
import { RemoveRoleParams, RemoveRoleResponse } from "../dto/removeRole.dto";
import { CreateRoleParams } from "../dto/createRoleParams.dto";
import {
    RemovePolicyFromRoleParams,
    RemovePolicyFromRoleResponse,
} from "../dto/deletePolicyFromRole.dto";
import {
    AttachPolicyToUserParams,
    AttachPolicyToUserResponse,
} from "../dto/attachPolicyToUser.dto";
import {
    RemovePolicyFromUserParams,
    RemovePolicyFromUserResponse,
} from "../dto/removePolicyFromUser.dto";
import {
    AttachPolicyToRoleParams,
    AttachPolicyToRoleResponse,
} from "../dto/attachPolicyToRole.dto";
import { CreatePolicyParams } from "../dto/createPolicyParams.dto";
import { CreateOrFindPolicyParams } from "../dto/createOrFindPolicyParams.dto";

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
    databaseType: DataSourceOptions["type"];
    useClass?: Type<AuthorizationModuleFactory<UserEntity>>;
    useExisting?: Type<AuthorizationModuleFactory<UserEntity>>;
    useFactory?: (
        ...args: any[]
    ) =>
        | Promise<AuthorizationModuleOptions<UserEntity>>
        | AuthorizationModuleOptions<UserEntity>; // dependencies of imports to be injected with the class
}

export enum DatabaseConnectionType {
    SQL = "SQL",
    MONGO = "MONGO",
}

export interface IAuthorizationService<
    IRole extends SqlRole | MongoRole,
    IPolicy extends SqlPolicy | MongoPolicy,
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions,
    IUserPoliciesDenorm extends SqlUserPoliciesDenorm | MongoUserPoliciesDenorm,
    UserEntity extends DatabaseEntity
> {
    attachRoleToUser(
        user: UserEntity,
        roleId: IRole["id"]
    ): Promise<AttachRoleToUserResponse>;
    attachRoleToUserById(
        id: UserEntity["id"],
        roleId: IRole["id"]
    ): Promise<AttachRoleToUserResponse>;
    createOrFindPolicy(
        params: CreateOrFindPolicyParams<IPolicy>
    ): Promise<IPolicy>;
    createPolicy(params: CreatePolicyParams<IPolicy>): Promise<IPolicy>;
    createRole(params: CreateRoleParams): Promise<IRole>;
    checkUserAccess(
        params: CheckUserAccessRequest<UserEntity>
    ): Promise<boolean>;

    removeUser(
        id: UserEntity["id"],
        params: RemoveUserParams
    ): Promise<RemoveUserResponse<UserEntity>>;

    getUsers(): Promise<Array<UserEntity>>;
    getSubjectKey(): keyof UserEntity;
    getRole(roleId: IRole["id"]): Promise<IRole>;
    getRoles(
        where?: FindOptionsWhere<IRole>,
        select?: FindOptionsSelect<IRole>
    ): Promise<Array<IRole>>;
    getPolicies(
        where?: FindOptionsWhere<IPolicy>,
        select?: FindOptionsSelect<IPolicy>
    ): Promise<Array<IPolicy>>;
    getRolesForUser(userId: UserEntity["id"]): Promise<Array<IRole>>;
    getPoliciesForUser(userId: UserEntity["id"]): Promise<Array<IPolicy>>;
    removeRoleFromUser(
        params: RemoveRoleFromUserParams<UserEntity, IRole>
    ): Promise<RemoveRoleFromUserResponse>;
    removeRole(
        params: RemoveRoleParams<IRole>
    ): Promise<RemoveRoleResponse<IRole>>;
    removePolicyFromRole(
        params: RemovePolicyFromRoleParams<IPolicy, IRole>
    ): Promise<RemovePolicyFromRoleResponse<IPolicy, IRole>>;
    attachPolicyToUser(
        params: AttachPolicyToUserParams<IPolicy, UserEntity>
    ): Promise<AttachPolicyToUserResponse<IUserPermissions>>;
    removePolicyFromUser(
        params: RemovePolicyFromUserParams<IPolicy, UserEntity>
    ): Promise<RemovePolicyFromUserResponse>;
    attachPolicyToRole(
        params: AttachPolicyToRoleParams<IPolicy, IRole>
    ): Promise<AttachPolicyToRoleResponse<IPolicy, IRole>>;
}

export class IAuthorizationController<
    IRole extends SqlRole | MongoRole,
    IPolicy extends SqlPolicy | MongoPolicy,
    IUserPermissions extends SqlUserPermissions | MongoUserPermissions,
    IUserPoliciesDenorm extends SqlUserPoliciesDenorm | MongoUserPoliciesDenorm,
    UserEntity extends DatabaseEntity
> {
    constructor(
        protected readonly authorizationService: IAuthorizationService<
            IRole,
            IPolicy,
            IUserPermissions,
            IUserPoliciesDenorm,
            UserEntity
        >
    ) {}
    @Post("/role")
    async createRole(@Body() params: CreateRoleParams) {
        return this.authorizationService.createRole(params);
    }

    @Post("/policy")
    async createOrFindPolicy(
        @Body() params: CreateOrFindPolicyParams<IPolicy>
    ) {
        return this.authorizationService.createOrFindPolicy(params);
    }

    @Post("/user/:userId/role/:roleId")
    async attachRoleToUser(
        @Param("userId") id: UserEntity["id"],
        @Param("roleId") roleId: IRole["id"]
    ) {
        return this.authorizationService.attachRoleToUserById(id, roleId);
    }

    @Delete("role/:roleId/from_user/:userId")
    async removeRoleFromUser(
        @Param("roleId") roleId: IRole["id"],
        @Param("userId") userId: UserEntity["id"]
    ) {
        return this.authorizationService.removeRoleFromUser({ roleId, userId });
    }

    @Delete("role/:roleId")
    async removeRole(
        @Param("roleId") roleId: IRole["id"],
        @Body() params: RemoveRoleParams<IRole>
    ) {
        return this.authorizationService.removeRole({ roleId, ...params });
    }

    @Delete("user/:userId")
    async removeUser(
        @Param("userId") userId: UserEntity["id"],
        @Body() params: RemoveUserParams
    ) {
        return this.authorizationService.removeUser(userId, params);
    }

    @Post("role/:roleId/attach_policy")
    async attachPolicyToRole(
        @Body() params: AttachPolicyToRoleParams<IPolicy, IRole>
    ) {
        return this.authorizationService.attachPolicyToRole(params);
    }

    @Post("user/:userId/attach_policy")
    async attachPolicyToUser(
        @Body() params: AttachPolicyToUserParams<IPolicy, UserEntity>
    ) {
        return this.authorizationService.attachPolicyToUser(params);
    }

    @Delete("/user/:userId/policy")
    async removePolicyFromUser(
        @Param("userId") userId: UserEntity["id"],
        @Body() params: RemovePolicyFromUserParams<IPolicy, UserEntity>
    ) {
        return this.authorizationService.removePolicyFromUser({
            userId,
            ...params,
        });
    }

    @Delete("role/:roleId/policy")
    async removePolicyFromRole(
        @Param("roleId") roleId: IRole["id"],
        @Body() params: RemovePolicyFromRoleParams<IPolicy, IRole>
    ) {
        return this.authorizationService.removePolicyFromRole({
            ...params,
            roleId,
        });
    }

    @Get("/role/find")
    async findRoles(
        @Query("where") where?: FindOptionsWhere<IRole>,
        @Query("select") select?: FindOptionsSelect<IRole>
    ) {
        return this.authorizationService.getRoles(where, select);
    }

    @Get("/policy/find")
    async findPolicies(
        @Query("where") where?: FindOptionsWhere<IPolicy>,
        @Query("select") select?: FindOptionsSelect<IPolicy>
    ) {
        return this.authorizationService.getPolicies(where, select);
    }

    @Get("/role/:roleId")
    async getRoleById(@Param("roleId") roleId: IRole["id"]) {
        return this.authorizationService.getRole(roleId);
    }

    @Get("/role/:roleId/policies")
    async getPoliciesForRole(@Param("roleId") roleId: IRole["id"]) {
        return this.authorizationService.getPoliciesForUser(roleId);
    }

    @Get("/user/:userId/roles")
    async getRolesForUser(@Param("userId") userId: UserEntity["id"]) {
        return this.authorizationService.getRolesForUser(userId);
    }

    @Get("/user/:userId/policies")
    async getPoliciesForUser(@Param("userId") userId: UserEntity["id"]) {
        return this.authorizationService.getPoliciesForUser(userId);
    }
}
