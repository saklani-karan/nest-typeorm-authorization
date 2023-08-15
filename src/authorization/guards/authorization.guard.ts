import { ACCESS_PERMISSION_METADATA } from "../constants/abac.constants";
import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
    checkDynamicParameterType,
    DynamicParameterType,
    GetKeyFromRouteSource,
    getKeySourceFromDynamicParamaterType,
    InjectAuthorizationService,
    SetAccessPermissionsConfigType,
} from "../decorators/abac.decorator";
import { DatabaseEntity } from "../services/authorization.interface";
import { AuthorizationService } from "../services/authorization.service";
import { Logger } from "../../helpers/logger";
import { Permission } from "../dto/checkUserAccess.dto";

@Injectable()
export class AuthorizationGuard<UserEntity extends DatabaseEntity>
    implements CanActivate
{
    private readonly logger = new Logger("authorizationGurad");
    constructor(
        @InjectAuthorizationService()
        private readonly authorizationService: AuthorizationService<UserEntity>,
        @Inject(Reflector.name)
        private readonly reflector: Reflector
    ) {}
    async canActivate(context: ExecutionContext): Promise<boolean> {
        this.logger.log("received request");
        const accessPermissionConfigurations: Array<SetAccessPermissionsConfigType> =
            this.reflector.get<Array<SetAccessPermissionsConfigType>>(
                ACCESS_PERMISSION_METADATA,
                context.getHandler()
            );
        this.logger.log(
            `accessPermissionConfigurations: ${JSON.stringify(
                accessPermissionConfigurations
            )}`
        );
        if (
            !accessPermissionConfigurations?.filter(
                (accessConfig) => accessConfig
            )?.length
        ) {
            return true;
        }
        const permissions: Array<Permission> =
            accessPermissionConfigurations.map(
                (accessConfiguration: SetAccessPermissionsConfigType) => {
                    return this.convertAccessPermissionConfigTypeToPermission(
                        accessConfiguration,
                        context
                    );
                }
            );
        this.logger.log(`permissions: ${JSON.stringify(permissions)}`);
        const request: any = context.switchToHttp().getRequest();
        const { user }: { user: any } = request;

        const authorized: boolean =
            await this.authorizationService.checkUserAccess({
                permissions,
                subject:
                    user && user[this.authorizationService.getSubjectKey()]
                        ? user[this.authorizationService.getSubjectKey()]
                        : user,
                id: user?.id,
            });
        this.logger.log(`authorized: ${authorized}`);

        if (!authorized) {
            throw new HttpException(
                "User not authorized to access resource",
                HttpStatus.UNAUTHORIZED
            );
        }
        return true;
    }

    convertAccessPermissionConfigTypeToPermission(
        accessPermissionsConfigType: SetAccessPermissionsConfigType,
        context: ExecutionContext
    ): Permission {
        const permission: Permission = {
            resource: null,
            action: null,
        };
        Object.keys(accessPermissionsConfigType).map((key: string) => {
            const value: DynamicParameterType | string =
                accessPermissionsConfigType[key];
            if (checkDynamicParameterType(value)) {
                permission[key] = this.getDynamicConfigurationFromContext(
                    value as DynamicParameterType,
                    context
                );
            } else {
                permission[key] = accessPermissionsConfigType[key];
            }
        });
        return permission;
    }

    getDynamicConfigurationFromContext(
        dynamicParameterType: DynamicParameterType,
        context: ExecutionContext
    ): string {
        const source: GetKeyFromRouteSource =
            getKeySourceFromDynamicParamaterType(dynamicParameterType);
        const key = dynamicParameterType.split(":")[1];
        switch (source) {
            case GetKeyFromRouteSource.BODY:
                return this.getDynamicKeyFromBody(key, context);
            case GetKeyFromRouteSource.HEADERS:
                return this.getDynamicKeyFromRequestHeaders(key, context);
            case GetKeyFromRouteSource.PARAMS:
                return this.getDynamicKeyFromRequestParams(key, context);
        }
    }

    getDynamicKeyFromBody(key: string, context: ExecutionContext): string {
        const request: any = context.switchToHttp().getRequest();
        const body = request.body;
        return body[key];
    }

    getDynamicKeyFromRequestParams(
        key: string,
        context: ExecutionContext
    ): string {
        const request: any = context.switchToHttp().getRequest();
        const params = request.params;
        return params[key];
    }

    getDynamicKeyFromRequestHeaders(
        key: string,
        context: ExecutionContext
    ): string {
        const request: any = context.switchToHttp().getRequest();
        const headers = request.headers;
        return headers[key] as string;
    }
}
