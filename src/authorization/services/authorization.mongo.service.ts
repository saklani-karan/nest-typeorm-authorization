import { Inject, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    DataSourceOptions,
    DeepPartial,
    EntityTarget,
    FindOptionsSelect,
    FindOptionsWhere,
    MongoRepository,
    ObjectLiteral,
} from "typeorm";
import { ObjectId, MongoClient, MongoClientOptions } from "mongodb";
import { Logger } from "../../helpers/logger";
import { ABAC_MODULE_OPTIONS } from "../constants/abac.constants";
import { CreateOrFindPolicyParams } from "../dto/createOrFindPolicyParams.dto";
import { CreatePolicyParams } from "../dto/createPolicyParams.dto";
import { CreateRoleParams } from "../dto/createRoleParams.dto";
import {
    getMongoEntities,
    Policy,
    Role,
    UserPermissions,
    UserPoliciesDenorm,
} from "../entities/mongodb";
import { InternalServerError } from "../exceptions/InternalServerError.exception";
import { PolicyExistsException } from "../exceptions/PolicyExistsException.exception";
import {
    RoleAlreadyExistsException,
    RoleAlreadyExistsOnUserException,
} from "../exceptions/RoleExistsException.exception";
import { RoleNotFoundException } from "../exceptions/RoleNotFoundException.exception";
import {
    AuthorizationModuleOptions,
    DatabaseConnectionType,
    DatabaseEntity,
    IAuthorizationService,
} from "./authorization.interface";
import {
    AttachPolicyToRoleParams,
    AttachPolicyToRoleResponse,
} from "../dto/attachPolicyToRole.dto";
import {
    ConflicitingPolicyDataException,
    InsufficientPolicyDataException,
} from "../exceptions/InsufficientPolicyData.exception";
import {
    AddRoleToPolicyTransaction,
    AddRoleToPolicyTransactionOutput,
} from "../transactions/addPolicyToRoleTransaction";
import {
    RemovePolicyFromRoleTransaction,
    RemovePolicyFromRoleTransactionOutput,
} from "../transactions/removePolicyFromRoleTransaction";
import {
    RemovePolicyFromRoleParams,
    RemovePolicyFromRoleResponse,
} from "../dto/deletePolicyFromRole.dto";
import { PolicyNotFoundException } from "../exceptions/PolicyNotFoundException.exception";
import { PolicyNotAttachedOnRoleException } from "../exceptions/PolicyNotAttachedOnRole.exception";
import { RoleCannotBeEmptyException } from "../exceptions/EmptyRoleExceptions.exception";
import { AttachRoleToUserResponse } from "../dto/attachRoleToUser.dto";
import { SubjectCannotBeEmptyException } from "../exceptions/SubjectCannotBeEmptyException";
import { AddRoleToUserTransaction } from "../transactions/addRoleToUser.transaction";
import { UserNotFoundException } from "../exceptions/UserNotFoundException.exception";
import {
    RemoveRoleFromUserParams,
    RemoveRoleFromUserResponse,
} from "../dto/removeRoleFromUser.dto";
import { RoleNotAttachedOnUserException } from "../exceptions/RoleNotAttachedOnUserException.exception";
import { RemoveRoleFromUserTransaction } from "../transactions/removeRoleFromUserTransaction";
import { RemoveUserParams, RemoveUserResponse } from "../dto/removeUser.dto";
import { RemoveUserTransaction } from "../transactions/removeUserTransaction";
import { RemoveRoleParams, RemoveRoleResponse } from "../dto/removeRole.dto";
import { RoleAttachedOnUsersException } from "../exceptions/RoleAttachedOnUser.exception";
import { RemoveRoleTransaction } from "../transactions/removeRoleTransaction";
import {
    AttachPolicyToUserParams,
    AttachPolicyToUserResponse,
} from "../dto/attachPolicyToUser.dto";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { PolicyAlreadyAttachedOnUserException } from "../exceptions/PolicyAlreadyAttachedOnUser.exception";
import {
    AddPolicyToUserTransaction,
    AddPolicyToUserTransactionOutput,
} from "../transactions/addPolicyToUserTransaction";
import {
    RemovePolicyFromUserParams,
    RemovePolicyFromUserResponse,
} from "../dto/removePolicyFromUser.dto";
import { PolicyNotAttachedOnUserException } from "../exceptions/PolicyNotAttachedOnUser.exception";
import { RemovePolicyFromUserTransaction } from "../transactions/removePolicyFromUserTransaction";
import { CheckUserAccessRequest } from "../dto/checkUserAccess.dto";

export class AuthorizationMongoService<UserEntity extends DatabaseEntity>
    implements
        OnModuleInit,
        IAuthorizationService<
            Role,
            Policy,
            UserPermissions,
            UserPoliciesDenorm,
            UserEntity
        >
{
    private datasource: DataSource;
    private mongoClient: MongoClient;
    private roleRepository: MongoRepository<Role> = null;
    private policyRepository: MongoRepository<Policy> = null;
    private userPermissionsRepository: MongoRepository<UserPermissions> = null;
    private userPoliciesDenormRepository: MongoRepository<UserPoliciesDenorm> =
        null;
    private userRepository: MongoRepository<UserEntity> = null;
    private addRoleToPolicyTransaction: AddRoleToPolicyTransaction = null;
    private removePolicyFromRoleTransaction: RemovePolicyFromRoleTransaction =
        null;
    private addRoleToUserTransaction: AddRoleToUserTransaction<UserEntity> =
        null;
    private removeRoleFromUserTransaction: RemoveRoleFromUserTransaction<UserEntity> =
        null;
    private removeUserTransaction: RemoveUserTransaction<UserEntity> = null;
    private removeRoleTransaction: RemoveRoleTransaction = null;
    private addPolicyToUserTransaction: AddPolicyToUserTransaction<UserEntity> =
        null;
    private removePolicyFromUserTransaction: RemovePolicyFromUserTransaction<UserEntity> =
        null;
    private readonly logger: Logger = new Logger("authorizationMongoService");
    constructor(
        @Inject(ABAC_MODULE_OPTIONS)
        private readonly options: AuthorizationModuleOptions<UserEntity>
    ) {}
    async onModuleInit() {
        const datasourceConnectionOptions: DataSourceOptions = {
            ...this.options.databaseConnectionOptions,
            entities: [...getMongoEntities(), this.options.userEntity],
        };
        const datasource = new DataSource(datasourceConnectionOptions);
        await datasource.initialize();
        this.datasource = datasource;
        this.roleRepository = datasource.getMongoRepository(Role);
        this.userRepository = datasource.getMongoRepository(
            this.options.userEntity
        );
        this.policyRepository = datasource.getMongoRepository(Policy);
        this.userPermissionsRepository =
            datasource.getMongoRepository(UserPermissions);
        this.userPoliciesDenormRepository =
            datasource.getMongoRepository(UserPoliciesDenorm);
        this.addRoleToPolicyTransaction = new AddRoleToPolicyTransaction(
            datasource
        );
        this.removeUserTransaction = new RemoveUserTransaction(datasource);
        this.addRoleToUserTransaction = new AddRoleToUserTransaction(
            datasource
        );
        this.removeRoleFromUserTransaction = new RemoveRoleFromUserTransaction(
            datasource
        );
        this.addPolicyToUserTransaction = new AddPolicyToUserTransaction(
            datasource
        );
        this.removePolicyFromUserTransaction =
            new RemovePolicyFromUserTransaction(datasource);
    }

    async attachRoleToUserById(
        id: UserEntity["id"],
        roleId: ObjectId
    ): Promise<AttachRoleToUserResponse> {
        const logger: Logger = this.logger.createForMethod(
            "attachRoleToUserById"
        );
        const user: UserEntity = await this.userRepository.findOne({
            where: { _id: new ObjectId(id) },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id });
            logger.error("user not found for id", userNotFoundException);
            throw userNotFoundException;
        }

        return this.attachRoleToUser(user, roleId);
    }

    async attachPolicyToUser(
        params: AttachPolicyToUserParams<Policy, UserEntity>
    ): Promise<AttachPolicyToUserResponse<UserPermissions>> {
        const logger: Logger =
            this.logger.createForMethod("attachPolicyToUser");
        const { action, policyId, resource, userId } = params;

        if (!policyId && !(resource && action)) {
            const insufficientPolicyDataException: InsufficientPolicyDataException =
                new InsufficientPolicyDataException();
            logger.error(
                "insufficient policy data provided",
                insufficientPolicyDataException
            );
            throw insufficientPolicyDataException;
        }

        let [previousPolicy, user, policy]: [Policy, UserEntity, Policy] =
            await Promise.all([
                resource && action
                    ? this.policyRepository.findOne({
                          where: {
                              resource,
                              action,
                          },
                      })
                    : null,
                this.userRepository.findOne({
                    where: { _id: new ObjectId(userId) },
                }),
                policyId
                    ? this.policyRepository.findOne({
                          where: {
                              _id: new ObjectId(policyId),
                          },
                      })
                    : null,
            ]);

        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id: userId });
            logger.error("user not found for userId", userNotFoundException);
            throw userNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        if (
            previousPolicy &&
            policyId &&
            policy &&
            previousPolicy.id != policy.id
        ) {
            const conflicitingPolicyDataException: ConflicitingPolicyDataException<Policy> =
                new ConflicitingPolicyDataException(previousPolicy, policy);
            logger.error(
                "conflicting policy data found",
                conflicitingPolicyDataException
            );
            throw conflicitingPolicyDataException;
        }

        if (previousPolicy && !policy) {
            policy = previousPolicy;
        }

        if (!policy) {
            const policyNotFoundException: PolicyNotFoundException<Policy> =
                new PolicyNotFoundException({ policyId });
            logger.error("policy not found", policyNotFoundException);
            throw policyNotFoundException;
        }

        const [existingDenormUserPolicyCount, userPermissions]: [
            number,
            UserPermissions
        ] = await Promise.all([
            this.userPoliciesDenormRepository.count({
                where: {
                    subject,
                    policyMapKey: convertPolicyToPolicyMapKey<Policy>(policy),
                    roleKey: null,
                },
            }),
            this.userPermissionsRepository.findOne({
                where: { subject },
            }),
        ]);

        if (existingDenormUserPolicyCount) {
            const policyAlreadyAttachedOnUser: PolicyAlreadyAttachedOnUserException<
                Policy,
                UserEntity
            > = new PolicyAlreadyAttachedOnUserException<Policy, UserEntity>({
                policyId,
                userId,
            });
            logger.error(
                "policy already attached on user",
                policyAlreadyAttachedOnUser
            );
            throw policyAlreadyAttachedOnUser;
        }

        if (!policy && !(resource && action)) {
            const insufficientPolicyDataException: InsufficientPolicyDataException =
                new InsufficientPolicyDataException();
            logger.error(
                "insufficient policy data provided",
                insufficientPolicyDataException
            );
            throw insufficientPolicyDataException;
        }

        let attachPolicyToUserTransactionOutput: AddPolicyToUserTransactionOutput[DatabaseConnectionType.MONGO];
        try {
            attachPolicyToUserTransactionOutput =
                (await this.addPolicyToUserTransaction.run({
                    policy,
                    policyCreationRequest: {
                        resource,
                        action,
                    },
                    subject,
                    user,
                    userPermissions,
                })) as AddPolicyToUserTransactionOutput[DatabaseConnectionType.MONGO];
        } catch (err) {
            logger.error("error creating policy", err as Error);
            throw err;
        }

        return {
            userPermissions:
                attachPolicyToUserTransactionOutput.userPermissions,
        };
    }

    async removePolicyFromUser(
        params: RemovePolicyFromUserParams<Policy, UserEntity>
    ): Promise<RemovePolicyFromUserResponse> {
        const logger: Logger = this.logger.createForMethod(
            "removePolicyFromUser"
        );
        const { policyId, userId } = params;
        const [policy, user]: [Policy, UserEntity] = await Promise.all([
            this.policyRepository.findOne({
                where: {
                    _id: new ObjectId(policyId),
                },
            }),
            this.userRepository.findOne({
                where: {
                    _id: new ObjectId(userId),
                },
            }),
        ]);

        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id: userId });
            logger.error("user not found for userId", userNotFoundException);
            throw userNotFoundException;
        }

        if (!policy) {
            const policyNotFoundException: PolicyNotFoundException<Policy> =
                new PolicyNotFoundException({ policyId });
            logger.error("policy not found", policyNotFoundException);
            throw policyNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        const userPermissions: UserPermissions =
            await this.userPermissionsRepository.findOne({
                where: { subject },
            });
        if (
            !userPermissions.policies.some((userPolicyId: ObjectId) => {
                return userPolicyId.toString() === policy.id.toString();
            })
        ) {
            const policyNotAttachedOnUserException: PolicyNotAttachedOnUserException<
                Policy,
                UserEntity
            > = new PolicyNotAttachedOnUserException<Policy, UserEntity>({
                policyId,
                userId,
            });
            logger.error(
                "policy not attached on user",
                policyNotAttachedOnUserException
            );
            throw policyNotAttachedOnUserException;
        }

        try {
            await this.removePolicyFromUserTransaction.run({
                policy,
                subject,
                user,
                userPermissions,
            });
        } catch (err) {
            logger.error("error on running transaction", err as Error);
            throw new InternalServerError(err);
        }

        return { success: true };
    }

    async checkUserAccess(
        params: CheckUserAccessRequest<UserEntity>
    ): Promise<boolean> {
        return false;
    }

    async getPoliciesForUser(userId: UserEntity["id"]): Promise<Policy[]> {
        const logger: Logger = this.logger.createForMethod(
            "attachRoleToUserById"
        );
        const user: UserEntity = await this.userRepository.findOne({
            where: { _id: new ObjectId(userId) },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id: userId });
            logger.error("user not found for id", userNotFoundException);
            throw userNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        const userPermissions: UserPermissions =
            await this.userPermissionsRepository.findOne({
                where: { subject },
            });

        if (userPermissions?.policies?.length) {
            return [];
        }
        return this.policyRepository.find({
            where: {
                _id: {
                    $in: userPermissions.policies,
                },
            },
        });
    }

    async getRolesForUser(userId: UserEntity["id"]): Promise<Role[]> {
        const logger: Logger = this.logger.createForMethod(
            "attachRoleToUserById"
        );
        const user: UserEntity = await this.userRepository.findOne({
            where: { _id: new ObjectId(userId) },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id: userId });
            logger.error("user not found for id", userNotFoundException);
            throw userNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        const userPermissions: UserPermissions =
            await this.userPermissionsRepository.findOne({
                where: { subject },
            });

        if (userPermissions?.roles?.length) {
            return [];
        }
        return this.roleRepository.find({
            where: {
                _id: {
                    $in: userPermissions.roles,
                },
            },
        });
    }

    async getUsers(): Promise<UserEntity[]> {
        return this.userRepository.find();
    }

    getSubjectKey(): keyof UserEntity {
        return this.options.subjectKey;
    }

    async removeUser(
        id: UserEntity["id"],
        params: RemoveUserParams
    ): Promise<RemoveUserResponse<UserEntity>> {
        const logger: Logger = this.logger.createForMethod("removeUser");
        logger.info(
            `removing permissions for user with id=${id} with params ${JSON.stringify(
                params
            )}`
        );
        const { deleteUser } = params;
        let user: UserEntity;
        try {
            user = await this.userRepository.findOne({
                where: {
                    _id: new ObjectId(id),
                },
            });
        } catch (err) {
            logger.error("error finding user from database", err as Error);
            throw err;
        }

        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id });
            logger.error("user not found for id", userNotFoundException);
            throw userNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        try {
            await this.removeUserTransaction.run({ deleteUser, subject, user });
        } catch (err) {
            logger.error(
                "error running user deletion transaction",
                err as Error
            );
            throw new InternalServerError(err);
        }

        return { success: true, user };
    }

    async removeRole(
        params: RemoveRoleParams<Role>
    ): Promise<RemoveRoleResponse<Role>> {
        const logger: Logger = new Logger("removeRole");
        const { forceRemove, roleId } = params;

        const [role, userCount] = await Promise.all([
            this.roleRepository.findOne({
                where: {
                    _id: new ObjectId(roleId),
                },
            }),
            this.userPermissionsRepository.count({
                where: {
                    roles: {
                        $elemMatch: {
                            $eq: new ObjectId(roleId),
                        },
                    },
                },
            }),
        ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error("user not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (userCount && !forceRemove) {
            const roleAttachedOnUserException: RoleAttachedOnUsersException<Role> =
                new RoleAttachedOnUsersException({ roleId, userCount });
            logger.error(
                "role has a few users attached and forceRemove is set as false",
                roleAttachedOnUserException
            );
            throw roleAttachedOnUserException;
        }

        try {
            await this.removeRoleTransaction.run({ role });
        } catch (err) {
            logger.error("error running transaction", err as Error);
            throw new InternalServerError(err);
        }

        return { role, usersAffected: userCount };
    }

    async attachRoleToUser(
        user: UserEntity,
        roleId: Role["id"]
    ): Promise<AttachRoleToUserResponse> {
        const logger: Logger = this.logger.createForMethod("attachRoleToUser");

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        const [userPermission, role]: [UserPermissions, Role] =
            await Promise.all([
                this.userPermissionsRepository.findOne({
                    where: {
                        subject,
                    },
                }),
                this.getRoleWithPolicies(roleId),
            ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error("no such role found", roleNotFoundException);
            throw roleNotFoundException;
        }

        userPermission?.roles?.forEach((userRoleId: ObjectId) => {
            if (userRoleId?.toString() === roleId.toString()) {
                const roleAlreadyExistsOnUserException: RoleAlreadyExistsOnUserException =
                    new RoleAlreadyExistsOnUserException({
                        role: role.name,
                        user: subject,
                    });
                logger.error(
                    "role already on user",
                    roleAlreadyExistsOnUserException
                );
                throw roleAlreadyExistsOnUserException;
            }
        });

        try {
            await this.addRoleToUserTransaction.run({
                role,
                subject,
                user,
                policies: role.policies as Policy[],
            });
        } catch (err) {
            logger.error("error saving transaction", err as Error);
            throw new InternalServerError(err);
        }

        return { success: true };
    }

    private async getRoleWithPolicies(roleId: Role["id"]): Promise<Role> {
        return this.roleRepository
            .aggregate([
                {
                    $match: {
                        _id: new ObjectId(roleId),
                    },
                },
                {
                    $lookup: {
                        from: "policy",
                        let: { policyIds: "$policies" },
                        as: "policies",
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ["$_id", "$$policyIds"],
                                    },
                                },
                            },
                        ],
                    },
                },
                {
                    $set: {
                        id: "$_id",
                    },
                },
            ])
            .toArray()
            .then((roles: Role[]) => {
                if (!roles?.length) {
                    return null;
                }
                return roles[0];
            });
    }

    async createPolicy(params: CreatePolicyParams<Policy>): Promise<Policy> {
        const logger: Logger = this.logger.createForMethod("createPolicy");
        const { resource, action } = params;

        logger.info(
            `creating policy for resouce.action '${resource}.${action}'`
        );
        const prevPolicyCount: number = await this.policyRepository.count({
            resource,
            action,
        });
        if (prevPolicyCount) {
            const policyExistsException: PolicyExistsException =
                new PolicyExistsException({ resource, action });
            logger.error(
                `policy with resource ${resource} and action ${action} already exists`,
                policyExistsException
            );
            throw policyExistsException;
        }

        const policyDao: DeepPartial<Policy> = this.policyRepository.create({
            resource,
            action,
        });

        let policy: Policy = null;
        try {
            policy = await this.policyRepository.save(policyDao);
        } catch (err) {
            logger.error(`error creating policy`, err as Error);
            throw new InternalServerError(err);
        }

        return policy;
    }

    async createOrFindPolicy(
        params: CreateOrFindPolicyParams<Policy>
    ): Promise<Policy> {
        const logger: Logger =
            this.logger.createForMethod("createOrFindPolicy");
        logger.info(`request received with params ${JSON.stringify(params)}`);

        const { resource, action } = params;
        let policy: Policy;

        try {
            policy = await this.policyRepository.findOne({
                where: { resource, action },
            });
        } catch (err) {
            logger.error("error while fetching policy", err as Error);
            throw new InternalServerError(err);
        }

        if (policy) {
            return policy;
        }

        return this.createPolicy({ resource, action });
    }

    async createRole(params: CreateRoleParams): Promise<Role> {
        const logger: Logger = this.logger.createForMethod("createRole");
        const { name } = params;
        const prevRoleCount: number = await this.roleRepository.count({
            name,
        });
        if (prevRoleCount) {
            const roleExistsException: RoleAlreadyExistsException =
                new RoleAlreadyExistsException({
                    role: name,
                });
            logger.error("role already exists exception", roleExistsException);
            throw roleExistsException;
        }

        let role: Role;

        try {
            role = this.roleRepository.create({
                name,
            });
            role = await this.roleRepository.save(role);
        } catch (err) {
            logger.error("error creating role", err as Error);
            throw new InternalServerError(err);
        }
        return role;
    }

    async getRole(roleId: ObjectId): Promise<Role> {
        const logger: Logger = this.logger.createForMethod("getRole");
        console.log(typeof roleId, roleId);
        let role: Role;

        try {
            role = await this.roleRepository.findOne({
                where: { _id: new ObjectId(roleId) },
            });
        } catch (err) {
            logger.error("error on fetching role", err as Error);
            throw new InternalServerError(err);
        }

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error("no role found", roleNotFoundException);
            throw roleNotFoundException;
        }

        return role;
    }

    private convertWhereToMongoWhereClause<MongoEntity>(
        where: FindOptionsWhere<MongoEntity>,
        target: EntityTarget<MongoEntity>
    ): ObjectLiteral {
        const whereClause: ObjectLiteral = {};
        if (where) {
            Object.keys(where)?.forEach((key: string) => {
                let formattedValue: any = where[key];
                let formattedKey = key;
                if (
                    target instanceof ObjectId &&
                    typeof where[key] === "string"
                ) {
                    formattedValue = new ObjectId(where[key]);
                }
                if (key === "id") {
                    formattedKey = "_id";
                }
                whereClause[formattedKey] = formattedValue;
            });
        }
        return whereClause;
    }

    async getRoles(
        where?: FindOptionsWhere<Role>,
        select?: FindOptionsSelect<Role>
    ): Promise<Role[]> {
        const logger: Logger = this.logger.createForMethod("getRoles");

        let whereClause: ObjectLiteral = {};
        if (where) {
            whereClause = this.convertWhereToMongoWhereClause<Role>(
                where,
                Role
            );
        }

        return this.roleRepository.find({
            where: whereClause,
            select,
        });
    }

    async removeRoleFromUser(
        params: RemoveRoleFromUserParams<UserEntity, Role>
    ): Promise<RemoveRoleFromUserResponse> {
        const logger: Logger =
            this.logger.createForMethod("removeRoleFromUser");
        const { roleId, userId } = params;

        const [role, user]: [Role, UserEntity] = await Promise.all([
            this.roleRepository.findOne({
                where: {
                    _id: new ObjectId(roleId),
                },
            }),
            this.userRepository.findOne({
                where: {
                    _id: new ObjectId(userId),
                },
            }),
        ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error("error finding role", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException({ id: userId });
            logger.error("error finding user", userNotFoundException);
            throw userNotFoundException;
        }

        const subject: string = user[this.options.subjectKey]?.toString();
        if (!subject) {
            const subjectCannotBeEmptyException: SubjectCannotBeEmptyException<UserEntity> =
                new SubjectCannotBeEmptyException<UserEntity>(
                    this.options.subjectKey
                );
            logger.error(
                `subject found to be empty`,
                subjectCannotBeEmptyException
            );
            throw subjectCannotBeEmptyException;
        }

        const userPermissions: UserPermissions =
            await this.userPermissionsRepository.findOne({
                where: {
                    subject,
                },
            });
        if (
            !userPermissions?.roles.some((userRoleId: ObjectId) => {
                return userRoleId.toString() === roleId.toString();
            })
        ) {
            const roleNotAttachedOnUserException: RoleNotAttachedOnUserException<
                Role,
                UserEntity
            > = new RoleNotAttachedOnUserException({ roleId, userId });
            logger.error("role not on user", roleNotAttachedOnUserException);
            throw roleNotAttachedOnUserException;
        }

        try {
            await this.removeRoleFromUserTransaction.run({
                role,
                subject,
                user,
                userPermissions,
            });
        } catch (err) {
            logger.error("error on running transaction", err as Error);
            throw err;
        }

        return { success: true };
    }

    async getPolicies(
        where?: FindOptionsWhere<Policy>,
        select?: FindOptionsSelect<Policy>
    ): Promise<Policy[]> {
        const logger: Logger = this.logger.createForMethod("getPolicies");
        let whereClause: ObjectLiteral = {};
        if (where) {
            whereClause = this.convertWhereToMongoWhereClause<Policy>(
                where,
                Policy
            );
        }
        return this.policyRepository.find({
            where: whereClause,
            select,
        });
    }

    async attachPolicyToRole(
        params: AttachPolicyToRoleParams<Policy, Role>
    ): Promise<AttachPolicyToRoleResponse<Policy, Role>> {
        const logger: Logger =
            this.logger.createForMethod("attachPolicyToRole");
        const { resource, action, roleId, policyId } = params;

        if (!policyId && !(resource && action)) {
            const insufficientPolicyDataException: InsufficientPolicyDataException =
                new InsufficientPolicyDataException();
            logger.error(
                "insufficient policy data provided",
                insufficientPolicyDataException
            );
            throw insufficientPolicyDataException;
        }

        let [previousPolicy, role, policy]: [Policy, Role, Policy] =
            await Promise.all([
                resource && action
                    ? this.policyRepository.findOne({
                          where: {
                              resource,
                              action,
                          },
                      })
                    : null,
                this.roleRepository.findOne({
                    where: {
                        id: roleId,
                    },
                }),
                policyId
                    ? this.policyRepository.findOne({
                          where: {
                              id: policyId,
                          },
                      })
                    : null,
            ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error(
                `role not found for id=${roleId}`,
                roleNotFoundException
            );
            throw roleNotFoundException;
        }

        if (
            previousPolicy &&
            policyId &&
            policy &&
            previousPolicy.id != policy.id
        ) {
            const conflicitingPolicyDataException: ConflicitingPolicyDataException<Policy> =
                new ConflicitingPolicyDataException(previousPolicy, policy);
            logger.error(
                "conflicting policy data found",
                conflicitingPolicyDataException
            );
            throw conflicitingPolicyDataException;
        }

        const addPolcyToRoleResponse: AddRoleToPolicyTransactionOutput[DatabaseConnectionType.MONGO] =
            (await this.addRoleToPolicyTransaction.run({
                createPolicyParams: {
                    resource,
                    action,
                },
                role,
                policy,
            })) as AddRoleToPolicyTransactionOutput[DatabaseConnectionType.MONGO];

        return {
            role: addPolcyToRoleResponse.role,
            policy: addPolcyToRoleResponse.policy,
        };
    }

    async removePolicyFromRole(
        params: RemovePolicyFromRoleParams<Policy, Role>
    ): Promise<RemovePolicyFromRoleResponse<Policy, Role>> {
        const { resource, action, policyId, roleId } = params;
        const logger: Logger = this.logger.createForMethod(
            "deletePolicyFromRole"
        );

        if (!policyId && !(resource && action)) {
            const insufficientPolicyDataException: InsufficientPolicyDataException =
                new InsufficientPolicyDataException();
            logger.error(
                "insufficient policy data provided",
                insufficientPolicyDataException
            );
            throw insufficientPolicyDataException;
        }

        let [policy, role, previousPolicy]: [Policy, Role, Policy] =
            await Promise.all([
                policyId
                    ? this.policyRepository.findOne({
                          where: {
                              id: policyId,
                          },
                      })
                    : null,
                this.roleRepository.findOne({
                    where: {
                        id: roleId,
                    },
                }),
                resource && action
                    ? this.policyRepository.findOne({
                          where: {
                              resource,
                              action,
                          },
                      })
                    : null,
            ]);

        if (
            previousPolicy &&
            policyId &&
            policy &&
            previousPolicy.id != policy.id
        ) {
            const conflicitingPolicyDataException: ConflicitingPolicyDataException<Policy> =
                new ConflicitingPolicyDataException(previousPolicy, policy);
            logger.error(
                "conflicting policy data found",
                conflicitingPolicyDataException
            );
            throw conflicitingPolicyDataException;
        }

        if (previousPolicy && !policy) {
            policy = previousPolicy;
        }

        if (!policy) {
            const policyNotFoundException: PolicyNotFoundException<Policy> =
                new PolicyNotFoundException({ policyId });
            logger.error("policy not found", policyNotFoundException);
            throw policyNotFoundException;
        }

        if (!role) {
            const roleNotFoundException: RoleNotFoundException<Role> =
                new RoleNotFoundException({ id: roleId });
            logger.error("role not found", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (
            !(role.policies as ObjectId[])?.some((policyId: ObjectId) => {
                return policyId == policy.id;
            })
        ) {
            const policyNotAttachedOnRoleException: PolicyNotAttachedOnRoleException<
                Policy,
                Role
            > = new PolicyNotAttachedOnRoleException({ policyId, roleId });
            logger.error(
                "policy to be deleted is not attached on role",
                policyNotAttachedOnRoleException
            );
            throw policyNotAttachedOnRoleException;
        }

        if (role.policies.length == 1) {
            const roleCannotBeEmptyException: RoleCannotBeEmptyException<Role> =
                new RoleCannotBeEmptyException({ roleId });
            logger.error(
                "deletion of policy would make the role empty",
                roleCannotBeEmptyException
            );
            throw roleCannotBeEmptyException;
        }

        const removePolicyFromRoleTransactionResponse: RemovePolicyFromRoleTransactionOutput[DatabaseConnectionType.MONGO] =
            await this.removePolicyFromRoleTransaction.run({
                policy,
                role,
            });
        logger.info(
            `removePolicyFromTransactionResponse ${JSON.stringify(
                removePolicyFromRoleTransactionResponse
            )}`
        );
        return {
            policy,
            role,
        };
    }
}
