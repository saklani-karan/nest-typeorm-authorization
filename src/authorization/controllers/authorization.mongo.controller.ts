import { Body, Controller, Get, Param, Post, UseFilters } from "@nestjs/common";
import { InjectAuthorizationService } from "../decorators/abac.decorator";
import { CreateOrFindPolicyParams } from "../dto/createOrFindPolicyParams.dto";
import { CreateRoleParams } from "../dto/createRoleParams.dto";
import { Policy, Role, UserPermissions } from "../entities/mongodb";
import { UserPoliciesDenorm } from "../entities/sql";
import { HttpExceptionFilter } from "../filters/HttpExceptionFilter.filter";
import {
    DatabaseEntity,
    IAuthorizationController,
} from "../services/authorization.interface";
import { AuthorizationMongoService } from "../services/authorization.mongo.service";

@UseFilters(HttpExceptionFilter)
@Controller("iam")
export class AuthorizationMongoController<
    UserEntity extends DatabaseEntity
> extends IAuthorizationController<
    Role,
    Policy,
    UserPermissions,
    UserPoliciesDenorm,
    UserEntity
> {
    constructor(
        @InjectAuthorizationService()
        authorizationService: AuthorizationMongoService<UserEntity>
    ) {
        super(authorizationService);
    }
}
