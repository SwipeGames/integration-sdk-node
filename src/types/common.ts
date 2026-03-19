import type { CoreTypes, IntegrationTypes } from "@swipegames/public-api";

export type PlatformType = CoreTypes.PlatformType;
export type User = CoreTypes.User;
export type CoreErrorCode = CoreTypes.ErrorResponseCode;
export type ErrorCode = IntegrationTypes.ErrorResponseWithCodeAndActionCode;
export type ErrorAction = IntegrationTypes.ErrorResponseWithCodeAndActionAction;

export type ErrorResponse = CoreTypes.ErrorResponse;
