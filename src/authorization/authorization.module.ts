import { DynamicModule, Global, Module, Provider, Type } from "@nestjs/common";
import {
    ABAC_MODULE_OPTIONS,
    ABAC_MODULE_TOKEN,
} from "./constants/abac.constants";
import { AuthorizationController } from "./controllers/authorization.controller";
import {
    AuthorizationModuleAsyncOptions,
    AuthorizationModuleFactory,
    AuthorizationModuleOptions,
    DatabaseEntity,
} from "./services/authorization.interface";
import { AuthorizationService } from "./services/authorization.service";

@Module({})
export class AuthorizationModule {
    static forRoot<UserEntity extends DatabaseEntity = any>(
        options: AuthorizationModuleOptions<UserEntity>
    ): DynamicModule {
        const provider: Provider = {
            provide: ABAC_MODULE_TOKEN,
            useValue: new AuthorizationService<UserEntity>(options),
        };
        return {
            module: AuthorizationModule,
            providers: [provider],
            controllers: [AuthorizationController<UserEntity>],
            exports: [provider],
        };
    }

    static forRootAsync<UserEntity extends DatabaseEntity = any>(
        options: AuthorizationModuleAsyncOptions<UserEntity>
    ): DynamicModule {
        const provider: Provider = {
            inject: [ABAC_MODULE_OPTIONS],
            provide: ABAC_MODULE_TOKEN,
            useFactory: async (
                options: AuthorizationModuleOptions<UserEntity>
            ): Promise<AuthorizationService<UserEntity>> => {
                return new AuthorizationService<UserEntity>(options);
            },
        };

        return {
            module: AuthorizationModule,
            imports: options.imports,
            providers: [
                ...this.createAsyncProvider<UserEntity>(options),
                provider,
            ],
            controllers: [AuthorizationController<UserEntity>],
            exports: [provider],
        };
    }

    static createAsyncProvider<UserEntity extends DatabaseEntity>(
        options: AuthorizationModuleAsyncOptions<UserEntity>
    ): Provider[] {
        if (options.useExisting || options.useFactory) {
            return [this.createAsyncOptionsProvider<UserEntity>(options)];
        }
        const useClass: Type<AuthorizationModuleFactory<UserEntity>> =
            options.useClass as Type<AuthorizationModuleFactory<UserEntity>>;

        return [
            this.createAsyncOptionsProvider<UserEntity>(options),
            {
                provide: useClass,
                useClass,
            },
        ];
    }

    static createAsyncOptionsProvider<UserEntity extends DatabaseEntity>(
        options: AuthorizationModuleAsyncOptions<UserEntity>
    ): Provider {
        if (options.useFactory) {
            return {
                provide: ABAC_MODULE_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject || [],
            };
        }
        const inject = [
            (options.useClass || options.useExisting) as Type<
                AuthorizationModuleFactory<UserEntity>
            >,
        ];

        return {
            provide: ABAC_MODULE_OPTIONS,
            useFactory: async (
                optionsFactory: AuthorizationModuleFactory<UserEntity>
            ) => await optionsFactory.createAuthorizationModuleOptions(),
            inject,
        };
    }
}
