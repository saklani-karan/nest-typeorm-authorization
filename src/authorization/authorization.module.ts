import { DynamicModule, Global, Module, Provider, Type } from "@nestjs/common";
import {
    ABAC_MODULE_OPTIONS,
    ABAC_MODULE_TOKEN,
} from "./constants/abac.constants";
import { AuthorizationController } from "./controllers/authorization.controller";
import { AuthorizationMongoController } from "./controllers/authorization.mongo.controller";
import {
    AuthorizationModuleAsyncOptions,
    AuthorizationModuleFactory,
    AuthorizationModuleOptions,
    DatabaseConnectionType,
    DatabaseEntity,
} from "./services/authorization.interface";
import { AuthorizationMongoService } from "./services/authorization.mongo.service";
import { AuthorizationService } from "./services/authorization.sql.service";

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
        asyncOptions: AuthorizationModuleAsyncOptions<UserEntity>
    ): DynamicModule {
        let databaseConnectionType: DatabaseConnectionType = null;
        const controllers: Array<any> = [];
        if (
            ["postgres", "sqlite", "mysql", "sqljs", "better-sqlite3"].includes(
                asyncOptions.databaseType
            )
        ) {
            controllers.push(AuthorizationController<UserEntity>);
            databaseConnectionType = DatabaseConnectionType.SQL;
        } else if (["mongodb"].includes(asyncOptions.databaseType)) {
            controllers.push(AuthorizationMongoController<UserEntity>);
            databaseConnectionType = DatabaseConnectionType.MONGO;
        }
        const provider: Provider = {
            inject: [ABAC_MODULE_OPTIONS],
            provide: ABAC_MODULE_TOKEN,
            useFactory: async (
                options: AuthorizationModuleOptions<UserEntity>
            ): Promise<
                | AuthorizationService<UserEntity>
                | AuthorizationMongoService<UserEntity>
            > => {
                if (
                    options.databaseConnectionOptions.type !==
                    asyncOptions.databaseType
                ) {
                    throw new Error(
                        `databaseType '${asyncOptions.databaseType}' does not match database in connection options '${options.databaseConnectionOptions.type}'`
                    );
                }
                switch (databaseConnectionType) {
                    case DatabaseConnectionType.MONGO:
                        return new AuthorizationMongoService(options);
                    case DatabaseConnectionType.SQL:
                        return new AuthorizationService(options);
                }
            },
        };

        return {
            module: AuthorizationModule,
            imports: asyncOptions.imports,
            providers: [
                ...this.createAsyncProvider<UserEntity>(asyncOptions),
                provider,
            ],
            controllers,
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
