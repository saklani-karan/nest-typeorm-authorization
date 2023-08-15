import {
    Injectable,
    Inject,
    OnModuleInit,
    HttpException,
    HttpStatus,
    OnModuleDestroy,
} from "@nestjs/common";
import {
    DataSource,
    DataSourceOptions,
    FindOptionsSelect,
    FindOptionsWhere,
    Repository,
} from "typeorm";
import { ABAC_MODULE_OPTIONS } from "../constants/abac.constants";
import { AuthorizationModuleOptions, DatabaseEntity } from "./abac.interface";
import { getEntities } from "../entities";
import { Role } from "../entities/postgres/role.entity";
import { CreateRoleParams } from "../dto/createRoleParams.dto";
import { Logger } from "../../helpers/logger";
import { RoleAlreadyExistsException } from "../exceptions/RoleExistsException.exception";
import { CreatePolicyParams } from "../dto/createPolicyParams.dto";
import { Policy } from "../entities/postgres/policy.entity";
import { PolicyExistsException } from "../exceptions/PolicyExistsException.exception";
import { CreateOrFindPolicyParams } from "../dto/createOrFindPolicyParams.dto";
import { SubjectCannotBeEmptyException } from "../exceptions/SubjectCannotBeEmptyException";
import { UserPermissions } from "../entities/postgres/userPermissions.entity";
import { AddRoleToUserTransaction } from "../transactions/addRoleToUser.transaction";
import { UserNotFoundException } from "../exceptions/UserNotFoundException.exception";
import { RoleNotFoundException } from "../exceptions/RoleNotFoundException.exception";
import {
    AttachPolicyToRoleParams,
    AttachPolicyToRoleResponse,
} from "../dto/attachPolicyToRole.dto";
import {
    AddRoleToPolicyTransaction,
    AddRoleToPolicyTransactionOutput,
} from "../transactions/addPolicyToRoleTransaction";
import {
    EmptyRoleException,
    RoleCannotBeEmptyException,
} from "../exceptions/EmptyRoleExceptions.exception";
import {
    RemovePolicyFromRoleParams,
    RemovePolicyFromRoleResponse,
} from "../dto/deletePolicyFromRole.dto";
import { PolicyNotFoundException } from "../exceptions/PolicyNotFoundException.exception";
import { PolicyNotAttachedOnRoleException } from "../exceptions/PolicyNotAttachedOnRole.exception";
import {
    RemovePolicyFromRoleTransaction,
    RemovePolicyFromRoleTransactionOutput,
} from "../transactions/removePolicyFromRoleTransaction";
import {
    AttachPolicyToUserParams,
    AttachPolicyToUserResponse,
} from "../dto/attachPolicyToUser.dto";
import { UserPoliciesDenorm } from "../entities/postgres/userPoliciesDenorm.entity";
import { convertPolicyToPolicyMapKey } from "../../helpers/utils";
import { PolicyAlreadyAttachedOnUserException } from "../exceptions/PolicyAlreadyAttachedOnUser.exception";
import {
    AddPolicyToUserTransaction,
    AddPolicyToUserTransactionResponse,
} from "../transactions/addPolicyToUserTransaction";
import {
    RemovePolicyFromUserParams,
    RemovePolicyFromUserResponse,
} from "../dto/removePolicyFromUser.dto";
import { PolicyNotAttachedOnUserException } from "../exceptions/PolicyNotAttachedOnUser.exception";
import { RemovePolicyFromUserTransaction } from "../transactions/removePolicyFromUserTransaction";
import {
    RemoveRoleFromUserParams,
    RemoveRoleFromUserResponse,
} from "../dto/removeRoleFromUser.dto";
import { RoleNotAttachedOnUserException } from "../exceptions/RoleNotAttachedOnUserException.exception";
import { RemoveRoleFromUserTransaction } from "../transactions/removeRoleFromUserTransaction";
import { RemoveRoleParams, RemoveRoleResponse } from "../dto/removeRole.dto";
import { RoleAttachedOnUsersException } from "../exceptions/RoleAttachedOnUser.exception";
import { RemoveRoleTransaction } from "../transactions/removeRoleTransaction";
import { RemoveUserParams, RemoveUserResponse } from "../dto/removeUser.dto";
import { RemoveUserTransaction } from "../transactions/removeUserTransaction";
import {
    ConflicitingPolicyDataException,
    InsufficientPolicyDataException,
} from "../exceptions/InsufficientPolicyData.exception";
import { CheckUserAccessRequest, Permission } from "../dto/checkUserAccess.dto";

@Injectable()
export class AuthorizationService<UserEntity extends DatabaseEntity>
    implements OnModuleInit, OnModuleDestroy
{
    private datasource: DataSource;
    private roleRepository: Repository<Role> = null;
    private policyRepository: Repository<Policy> = null;
    private userRepository: Repository<UserEntity> = null;
    private userPermissionsRepository: Repository<UserPermissions> = null;
    private userPoliciesDenormRepository: Repository<UserPoliciesDenorm> = null;
    private addRoleToUserTransaction: AddRoleToUserTransaction<UserEntity>;
    private addRoleToPolicyTransaction: AddRoleToPolicyTransaction;
    private removePolicyFromRoleTransaction: RemovePolicyFromRoleTransaction;
    private addPolicyToUserTransaction: AddPolicyToUserTransaction<UserEntity>;
    private removePolicyFromUserTransaction: RemovePolicyFromUserTransaction<UserEntity>;
    private removeRoleFromUserTransaction: RemoveRoleFromUserTransaction<UserEntity>;
    private removeUserTransaction: RemoveUserTransaction<UserEntity>;
    private removeRoleTransaction: RemoveRoleTransaction;
    private readonly logger = new Logger("authorization_service");
    constructor(
        @Inject(ABAC_MODULE_OPTIONS)
        private readonly options: AuthorizationModuleOptions<UserEntity>
    ) {}

    async onModuleInit() {
        const datasourceConnectionOptions: DataSourceOptions = {
            ...this.options.databaseConnectionOptions,
            entities: [
                ...getEntities(this.options.databaseConnectionOptions.type),
                this.options.userEntity,
            ],
            synchronize: true,
        };

        const datasource = new DataSource(datasourceConnectionOptions);
        await datasource.initialize();
        this.roleRepository = datasource.getRepository(Role);
        this.policyRepository = datasource.getRepository(Policy);
        this.userPermissionsRepository =
            datasource.getRepository(UserPermissions);
        this.userPoliciesDenormRepository =
            datasource.getRepository(UserPoliciesDenorm);
        this.userRepository = datasource.getRepository(this.options.userEntity);
        this.addRoleToUserTransaction = new AddRoleToUserTransaction(
            datasource
        );
        this.addRoleToPolicyTransaction = new AddRoleToPolicyTransaction(
            datasource
        );
        this.addPolicyToUserTransaction =
            new AddPolicyToUserTransaction<UserEntity>(datasource);
        this.removePolicyFromRoleTransaction =
            new RemovePolicyFromRoleTransaction(datasource);
        this.removePolicyFromUserTransaction =
            new RemovePolicyFromUserTransaction<UserEntity>(datasource);
        this.removeRoleFromUserTransaction =
            new RemoveRoleFromUserTransaction<UserEntity>(datasource);
        this.removeRoleTransaction = new RemoveRoleTransaction(datasource);
        this.removeUserTransaction = new RemoveUserTransaction<UserEntity>(
            datasource
        );
        this.datasource = datasource;
    }

    async checkUserAccess(
        params: CheckUserAccessRequest<UserEntity>
    ): Promise<boolean> {
        const logger: Logger = this.logger.createForMethod("checkUserAccess");
        const { permissions, id } = params;
        let { subject } = params;
        logger.info(`checking for user access for user ${subject}`);
        if (!subject && !id) {
            throw new HttpException(
                "Insufficient user data present, 'id' or 'subject' must be present",
                HttpStatus.BAD_REQUEST
            );
        }
        if (!subject) {
            const user: UserEntity = await this.userRepository.findOne({
                where: { id },
                select: [this.getSubjectKey()],
            });
            subject = user[this.getSubjectKey()] as string;
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
        }
        const userPoliciesMapKeySet: Set<string> = new Set();
        const permissionPoliciesMapKeySet: Set<string> = new Set();
        const whereClauses: Array<FindOptionsWhere<UserPoliciesDenorm>> =
            permissions.map((permission: Permission) => {
                const policyMapKey: string =
                    convertPolicyToPolicyMapKey(permission);
                permissionPoliciesMapKeySet.add(policyMapKey);
                return {
                    subject,
                    policyMapKey,
                };
            });

        const userPoliciesDenorm: Array<UserPoliciesDenorm> =
            await this.userPoliciesDenormRepository.find({
                where: whereClauses,
                select: { policyMapKey: true },
            });
        userPoliciesDenorm.forEach((denormPolicies: UserPoliciesDenorm) => {
            const { policyMapKey } = denormPolicies;
            userPoliciesMapKeySet.add(policyMapKey);
        });
        const permissionPolicyMapKeys: Array<string> = Array.from(
            permissionPoliciesMapKeySet
        );
        for (let i = 0; i < permissionPolicyMapKeys.length; i++) {
            const policyMapKey = permissionPolicyMapKeys[i];
            if (!userPoliciesMapKeySet.has(policyMapKey)) {
                return false;
            }
        }
        return true;
    }

    async onModuleDestroy() {
        this.logger.info("shutting down database connection");
        await this.datasource.destroy();
        this.logger.info("shutdown completed");
    }

    async attachRoleToUserById(id: UserEntity["id"], roleId: Role["id"]) {
        const logger: Logger = this.logger.createForMethod(
            "attachRoleToUserById"
        );
        const user: UserEntity = await this.userRepository.findOne({
            where: { id },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({ id });
            logger.error("user not found for id", userNotFoundException);
            throw userNotFoundException;
        }

        return this.attachRoleToUser(user, roleId);
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
                    id,
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
            throw new HttpException(
                (err as Error)?.message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return { user, success: true };
    }

    async attachRoleToUser(user: UserEntity, roleId: Role["id"]) {
        const logger: Logger = this.logger.createForMethod("attachRoleToUser");
        logger.info(`attaching role ${roleId} to user ${user}`);

        let role: Role = null;

        try {
            role = await this.roleRepository.findOne({
                where: {
                    id: roleId,
                },
                relations: {
                    policies: true,
                },
            });
        } catch (err) {
            this.logger.error("error finding role", err as Error);
            throw err;
        }

        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("user not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (!role?.policies?.length) {
            const emptyRoleException: EmptyRoleException =
                new EmptyRoleException({ roleId });
            logger.error(
                "role does not contain any policies",
                emptyRoleException
            );
            throw emptyRoleException;
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
            await this.addRoleToUserTransaction.run({
                role,
                user,
                subject,
            });
        } catch (err) {
            err = err as Error;
            logger.error(
                "an error was encountered while saving the transaction",
                err as Error
            );
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(
                (err as Error).message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return { success: true };
    }

    async getUsers(): Promise<Array<UserEntity>> {
        return this.userRepository.find();
    }

    getSubjectKey(): keyof UserEntity {
        return this.options.subjectKey;
    }

    async getRole(roleId: Role["id"]): Promise<Role> {
        const logger: Logger = this.logger.createForMethod("getRole");
        const role: Role = await this.roleRepository.findOne({
            where: { id: roleId },
            relations: { policies: true },
        });
        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("role not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

        return role;
    }

    async getRoles(
        where?: FindOptionsWhere<Role>,
        select?: FindOptionsSelect<Role>
    ): Promise<Array<Role>> {
        return this.roleRepository.find({ where, select });
    }

    async getPolicies(
        where?: FindOptionsWhere<Policy>,
        select?: FindOptionsSelect<Policy>
    ): Promise<Array<Policy>> {
        return this.policyRepository.find({ where, select });
    }

    async getRolesForUser(userId: UserEntity["id"]): Promise<Array<Role>> {
        const logger: Logger = this.logger.createForMethod("getRolesForUser");
        logger.info(`fetching user with id ${userId}`);

        const user: UserEntity = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({
                    id: userId,
                });
            logger.error(
                `user not found for id =${userId}`,
                userNotFoundException
            );
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
                relations: { roles: true },
            });
        if (!userPermissions?.roles?.length) {
            return [];
        }

        return userPermissions.roles;
    }

    async getPoliciesForUser(userId: UserEntity["id"]): Promise<Array<Policy>> {
        const logger: Logger = this.logger.createForMethod("getRolesForUser");
        logger.info(`fetching user with id ${userId}`);

        const user: UserEntity = await this.userRepository.findOne({
            where: { id: userId },
        });
        if (!user) {
            const userNotFoundException: UserNotFoundException<UserEntity> =
                new UserNotFoundException<UserEntity>({
                    id: userId,
                });
            logger.error(
                `user not found for id =${userId}`,
                userNotFoundException
            );
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
                relations: { policies: true },
            });
        if (!userPermissions?.policies?.length) {
            return [];
        }

        return userPermissions.policies;
    }

    async getPoliciesForRole(roleId: Role["id"]): Promise<Array<Policy>> {
        const logger: Logger =
            this.logger.createForMethod("getPoliciesForRole");
        logger.info(`fetching policies for role`);

        const role: Role = await this.roleRepository.findOne({
            where: { id: roleId },
            relations: { policies: true },
        });
        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("role not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (!role?.policies?.length) {
            return [];
        }

        return role.policies;
    }

    async removeRoleFromUser(
        params: RemoveRoleFromUserParams<UserEntity>
    ): Promise<RemoveRoleFromUserResponse> {
        const logger: Logger =
            this.logger.createForMethod("removeRoleFromuser");
        const { roleId, userId } = params;

        const [role, user]: [Role, UserEntity] = await Promise.all([
            this.roleRepository.findOne({
                where: {
                    id: roleId,
                },
            }),
            this.userRepository.findOne({
                where: {
                    id: userId,
                },
            }),
        ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("user not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

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
                relations: { roles: true },
            });
        if (
            !userPermissions.roles.some((userRole: Role) => {
                return userRole.id == role.id;
            })
        ) {
            const roleNotAttachedOnUserException: RoleNotAttachedOnUserException<UserEntity> =
                new RoleNotAttachedOnUserException<UserEntity>({
                    roleId,
                    userId,
                });
            logger.error(
                "role not attached on user",
                roleNotAttachedOnUserException
            );
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
            logger.info("error on removing policy", err as Error);
            throw new HttpException(
                "an error occured while deleting the policy",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return { success: true };
    }

    async removeRole(params: RemoveRoleParams): Promise<RemoveRoleResponse> {
        const { roleId, forceRemove } = params;
        const logger: Logger = this.logger.createForMethod("removeRole");

        const [role, userCount] = await Promise.all([
            this.roleRepository.findOne({ where: { id: roleId } }),
            this.datasource.manager.query(
                "SELECT COUNT (*) FROM user_permission_roles WHERE role_id=$1",
                [roleId]
            ),
        ]);

        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("user not found for id", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (userCount && !forceRemove) {
            const roleAttachedOnUserException: RoleAttachedOnUsersException =
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
            logger.error(
                "error in transaction removing the role",
                err as Error
            );
            throw new HttpException(
                (err as Error).message,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return {
            role,
            usersAffected: userCount,
        };
    }

    async createRole(params: CreateRoleParams): Promise<Role> {
        const logger: Logger = this.logger.createForMethod("createRole");
        logger.info(`received request with params ${JSON.stringify(params)}`);
        const { name } = params;

        logger.info(`creating role with name ${name}`);
        const prevRoleCount: number = await this.roleRepository.count({
            where: {
                name,
            },
        });
        if (prevRoleCount) {
            const roleExistsException: RoleAlreadyExistsException =
                new RoleAlreadyExistsException({
                    role: name,
                });
            logger.error(
                `role with name ${name} already exists`,
                roleExistsException
            );
            throw roleExistsException;
        }

        const roleDao: Role = this.roleRepository.create({
            name,
        });

        let role: Role = null;
        try {
            role = await this.roleRepository.save(roleDao);
        } catch (err) {
            logger.error(`error creating role`, err as Error);
            throw err;
        }

        return role;
    }

    async removePolicyFromRole(
        params: RemovePolicyFromRoleParams
    ): Promise<RemovePolicyFromRoleResponse> {
        const logger: Logger = this.logger.createForMethod(
            "deletePolicyFromRole"
        );
        const { policyId, roleId, resource, action } = params;

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
                    relations: {
                        policies: true,
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
            const conflicitingPolicyDataException: ConflicitingPolicyDataException =
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
            const policyNotFoundException: PolicyNotFoundException =
                new PolicyNotFoundException({ policyId });
            logger.error("policy not found", policyNotFoundException);
            throw policyNotFoundException;
        }

        if (!role) {
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error("role not found", roleNotFoundException);
            throw roleNotFoundException;
        }

        if (
            !role.policies?.some((rolePolicy: Policy) => {
                return rolePolicy.id == policy.id;
            })
        ) {
            const policyNotAttachedOnRoleException: PolicyNotAttachedOnRoleException =
                new PolicyNotAttachedOnRoleException({ policyId, roleId });
            logger.error(
                "policy to be deleted is not attached on role",
                policyNotAttachedOnRoleException
            );
            throw policyNotAttachedOnRoleException;
        }

        if (role.policies.length == 1) {
            const roleCannotBeEmptyException: RoleCannotBeEmptyException =
                new RoleCannotBeEmptyException({ roleId });
            logger.error(
                "deletion of policy would make the role empty",
                roleCannotBeEmptyException
            );
            throw roleCannotBeEmptyException;
        }

        const removePolicyFromRoleTransactionResponse: RemovePolicyFromRoleTransactionOutput =
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

    async attachPolicyToUser(
        params: AttachPolicyToUserParams<UserEntity>
    ): Promise<AttachPolicyToUserResponse<UserEntity>> {
        const logger: Logger =
            this.logger.createForMethod("attachPolicyToUser");
        const { resource, action, userId, policyId } = params;

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
                this.userRepository.findOne({ where: { id: userId } }),
                policyId
                    ? this.policyRepository.findOne({
                          where: {
                              id: policyId,
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
            const conflicitingPolicyDataException: ConflicitingPolicyDataException =
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
            const policyNotFoundException: PolicyNotFoundException =
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
                    policyMapKey: convertPolicyToPolicyMapKey(policy),
                },
            }),
            this.userPermissionsRepository.findOne({
                where: { subject },
            }),
        ]);

        if (existingDenormUserPolicyCount) {
            const policyAlreadyAttachedOnUser: PolicyAlreadyAttachedOnUserException<UserEntity> =
                new PolicyAlreadyAttachedOnUserException<UserEntity>({
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

        const attachPolicyToUserResponse: AddPolicyToUserTransactionResponse<UserEntity> =
            await this.addPolicyToUserTransaction.run({
                subject,
                policy,
                policyCreationRequest: {
                    resource,
                    action,
                },
                user,
                userPermissions,
            });
        logger.info(`attachPolicyToUserResponse ${attachPolicyToUserResponse}`);
        return {
            userPermissions: attachPolicyToUserResponse.userPermissions,
        };
    }

    async removePolicyFromUser(
        params: RemovePolicyFromUserParams<UserEntity>
    ): Promise<RemovePolicyFromUserResponse> {
        const logger: Logger = this.logger.createForMethod(
            "removePolicyFromUser"
        );
        const { userId, policyId } = params;

        const [user, policy]: [UserEntity, Policy] = await Promise.all([
            this.userRepository.findOne({ where: { id: userId } }),
            this.policyRepository.findOne({ where: { id: policyId } }),
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

        if (!policy) {
            const policyNotFoundException: PolicyNotFoundException =
                new PolicyNotFoundException({ policyId });
            logger.error("policy not found", policyNotFoundException);
            throw policyNotFoundException;
        }

        const userPermissions: UserPermissions =
            await this.userPermissionsRepository.findOne({
                where: { subject },
                relations: { policies: true },
            });

        if (
            !userPermissions?.policies?.some((userPolicy: Policy) => {
                return userPolicy.id == policy.id;
            })
        ) {
            const policyNotAttachedOnUserException: PolicyNotAttachedOnUserException<UserEntity> =
                new PolicyNotAttachedOnUserException<UserEntity>({
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
            logger.info("error on removing policy", err as Error);
            throw new HttpException(
                "an error occured while deleting the policy",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        return { success: true };
    }

    async attachPolicyToRole(
        params: AttachPolicyToRoleParams
    ): Promise<AttachPolicyToRoleResponse> {
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
                    relations: {
                        policies: true,
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
            const roleNotFoundException: RoleNotFoundException =
                new RoleNotFoundException({ id: roleId });
            logger.error(
                `role not found for id=${roleId}`,
                roleNotFoundException
            );
            throw roleNotFoundException;
        }

        if (previousPolicy && policyId && previousPolicy.id != policyId) {
            const policyExistsException: PolicyExistsException =
                new PolicyExistsException({ resource, action });
            logger.error(
                `policy with resource ${resource} and action ${action} already exists`,
                policyExistsException
            );
            throw policyExistsException;
        }

        if (
            previousPolicy &&
            policyId &&
            policy &&
            previousPolicy.id != policy.id
        ) {
            const conflicitingPolicyDataException: ConflicitingPolicyDataException =
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

        const addPolcyToRoleResponse: AddRoleToPolicyTransactionOutput =
            await this.addRoleToPolicyTransaction.run({
                createPolicyParams: {
                    resource,
                    action,
                },
                role,
                policy,
            });

        return {
            role: addPolcyToRoleResponse.role,
            policy: addPolcyToRoleResponse.policy,
        };
    }

    async createPolicy(params: CreatePolicyParams): Promise<Policy> {
        const logger: Logger = this.logger.createForMethod("createPolicy");
        const { resource, action } = params;

        logger.info(
            `creating policy for resouce.action '${resource}.${action}'`
        );
        const prevPolicyCount: number = await this.policyRepository.count({
            where: {
                resource,
                action,
            },
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

        const policyDao: Policy = this.policyRepository.create({
            resource,
            action,
        });

        let policy: Policy = null;
        try {
            policy = await this.roleRepository.save(policyDao);
        } catch (err) {
            logger.error(`error creating policy`, err as Error);
            throw err;
        }

        return policy;
    }

    async createOrFindPolicy(
        params: CreateOrFindPolicyParams
    ): Promise<Policy> {
        const logger: Logger =
            this.logger.createForMethod("createOrFindPolicy");
        logger.info(
            `createOrFindPolicy: received request with params ${JSON.stringify(
                params
            )}`
        );
        const { resource, action } = params;

        let policy: Policy = null;

        try {
            policy = await this.policyRepository.findOne({
                where: {
                    resource,
                    action,
                },
            });
        } catch (err) {
            logger.error(
                `error on finding policy for resource ${resource} and action ${action}`,
                err as Error
            );
            throw err;
        }

        if (policy) {
            logger.info(
                `policy found for resource ${resource} and action ${action} ${JSON.stringify(
                    policy
                )}`
            );
            return policy;
        }

        try {
            policy = await this.createPolicy({ resource, action });
        } catch (err) {
            logger.error("error creating policy", err as Error);
        }

        return policy;
    }
}
