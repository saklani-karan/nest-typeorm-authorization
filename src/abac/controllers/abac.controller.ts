import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseFilters,
} from "@nestjs/common";
import { FindOptionsSelect, FindOptionsWhere, Point } from "typeorm";
import { InjectAuthorizationService } from "../decorators/abac.decorator";
import { AttachPolicyToRoleParams } from "../dto/attachPolicyToRole.dto";
import { AttachPolicyToUserParams } from "../dto/attachPolicyToUser.dto";
import { CreateOrFindPolicyParams } from "../dto/createOrFindPolicyParams.dto";
import { CreateRoleParams } from "../dto/createRoleParams.dto";
import { RemovePolicyFromRoleParams } from "../dto/deletePolicyFromRole.dto";
import { RemovePolicyFromUserParams } from "../dto/removePolicyFromUser.dto";
import { RemoveRoleParams } from "../dto/removeRole.dto";
import { RemoveUserParams } from "../dto/removeUser.dto";
import { Policy } from "../entities/postgres/policy.entity";
import { Role } from "../entities/postgres/role.entity";
import { HttpExceptionFilter } from "../filters/HttpExceptionFilter.filter";
import { DatabaseEntity } from "../services/abac.interface";
import { AuthorizationService } from "../services/abac.service";

@UseFilters(HttpExceptionFilter)
@Controller("iam")
export class AuthorizationController<UserEntity extends DatabaseEntity> {
    constructor(
        @InjectAuthorizationService()
        private readonly authorizationService: AuthorizationService<UserEntity>
    ) {}

    @Post("/role")
    async createRole(@Body() params: CreateRoleParams) {
        return this.authorizationService.createRole(params);
    }

    @Post("/policy")
    async createOrFindPolicy(@Body() params: CreateOrFindPolicyParams) {
        return this.authorizationService.createOrFindPolicy(params);
    }

    @Post("/user/:userId/role/:roleId")
    async attachRoleToUser(
        @Param("userId") id: UserEntity["id"],
        @Param("roleId") roleId: Role["id"]
    ) {
        return this.authorizationService.attachRoleToUserById(id, roleId);
    }

    @Delete("role/:roleId/from_user/:userId")
    async removeRoleFromUser(
        @Param("roleId") roleId: Role["id"],
        @Param("userId") userId: UserEntity["id"]
    ) {
        return this.authorizationService.removeRoleFromUser({ roleId, userId });
    }

    @Delete("role/:roleId")
    async removeRole(
        @Param("roleId") roleId: Role["id"],
        @Body() params: RemoveRoleParams
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
    async attachPolicyToRole(@Body() params: AttachPolicyToRoleParams) {
        return this.authorizationService.attachPolicyToRole(params);
    }

    @Post("user/:userId/attach_policy")
    async attachPolicyToUser(
        @Body() params: AttachPolicyToUserParams<UserEntity>
    ) {
        return this.authorizationService.attachPolicyToUser(params);
    }

    @Delete("/user/:userId/policy")
    async removePolicyFromUser(
        @Param("userId") userId: UserEntity["id"],
        @Body() params: RemovePolicyFromUserParams<UserEntity>
    ) {
        return this.authorizationService.removePolicyFromUser({
            userId,
            ...params,
        });
    }

    @Delete("role/:roleId/policy")
    async removePolicyFromRole(
        @Param("roleId") roleId: Role["id"],
        @Body() params: RemovePolicyFromRoleParams
    ) {
        return this.authorizationService.removePolicyFromRole({
            ...params,
            roleId,
        });
    }

    @Get("/role/find")
    async findRoles(
        @Query("where") where?: FindOptionsWhere<Role>,
        @Query("select") select?: FindOptionsSelect<Role>
    ) {
        return this.authorizationService.getRoles(where, select);
    }

    @Get("/policy/find")
    async findPolicies(
        @Query("where") where?: FindOptionsWhere<Policy>,
        @Query("select") select?: FindOptionsSelect<Policy>
    ) {
        return this.authorizationService.getPolicies(where, select);
    }

    @Get("/role/:roleId")
    async getRoleById(@Param("roleId") roleId: Role["id"]) {
        return this.authorizationService.getRole(roleId);
    }

    @Get("/role/:roleId/policies")
    async getPoliciesForRole(@Param("roleId") roleId: Role["id"]) {
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
