import { Policy } from "../abac/entities/postgres/policy.entity";

export const convertPolicyToPolicyMapKey = (
    policy: Pick<Policy, "action" | "resource">
) => {
    const { resource, action } = policy;
    return `$${resource}$${action}`;
};
