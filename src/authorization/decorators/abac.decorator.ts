import { Inject } from "@nestjs/common";
import { ABAC_MODULE_TOKEN } from "../constants/abac.constants";

export const InjectAuthorizationService = () => Inject(ABAC_MODULE_TOKEN);

import { ACCESS_PERMISSION_METADATA } from "../constants/abac.constants";
import { SetMetadata } from "@nestjs/common";

export enum GetKeyFromRouteSource {
    BODY = "body",
    PARAMS = "params",
    HEADERS = "headers",
}

export type DynamicParameterType = `${GetKeyFromRouteSource}:${string}`;

export const checkDynamicParameterType = (value: string): boolean => {
    const startRegexCheck: Array<string> = Object.keys(
        GetKeyFromRouteSource
    ).map((key) => {
        if (isNaN(Number(key))) {
            return GetKeyFromRouteSource[key];
        }
    });
    const regex = new RegExp(`^(${startRegexCheck.join("|")}):`);
    return regex.test(value);
};

export const getKeySourceFromDynamicParamaterType = (
    value: DynamicParameterType
): GetKeyFromRouteSource => {
    const startRegexCheck: Array<string> = Object.keys(
        GetKeyFromRouteSource
    ).map((key) => {
        if (isNaN(Number(key))) {
            return GetKeyFromRouteSource[key];
        }
    });
    const regex = new RegExp(`^(${startRegexCheck.join("|")}):`);
    if (!regex.test(value)) {
        throw new Error("Invalid dynamic parameter type");
    }
    return value.match(regex)[0].slice(0, -1) as GetKeyFromRouteSource;
};

export type SetAccessPermissionsConfigType = {
    resource: DynamicParameterType | string;
    domain?: DynamicParameterType | string;
    action: DynamicParameterType | string;
};

export const SetAccessPermissions = (
    permissions: Array<SetAccessPermissionsConfigType>
) => SetMetadata(ACCESS_PERMISSION_METADATA, permissions);
