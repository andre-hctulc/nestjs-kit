import { Injectable, InternalServerErrorException, type OnModuleInit } from "@nestjs/common";
import {
    authorizationCodeGrant,
    buildAuthorizationUrl,
    buildEndSessionUrl,
    discovery,
    refreshTokenGrant,
    type AuthorizationCodeGrantChecks,
    type AuthorizationCodeGrantOptions,
    type ClientAuth,
    type ClientMetadata,
    type Configuration,
    type DiscoveryRequestOptions,
    type DPoPOptions,
    type TokenEndpointResponse,
    type TokenEndpointResponseHelpers,
} from "openid-client";
import {
    type CryptoKey,
    type JWTPayload,
    type JWTVerifyOptions,
    type JWTVerifyResult,
    type RemoteJWKSetOptions,
    createRemoteJWKSet,
    jwtVerify,
} from "jose";

export interface OpenIDClientServiceConfig {
    discoveryOptions?: {
        metadata?: Partial<ClientMetadata> | string;
        clientAuthentication?: ClientAuth;
        options?: DiscoveryRequestOptions;
    };
    jwkSetOptions?: RemoteJWKSetOptions;
}

@Injectable()
export abstract class OpenIDClientCService implements OnModuleInit {
    #conf: Configuration | undefined;
    #keyFunc: (() => Promise<CryptoKey>) | undefined;
    #init: OpenIDClientServiceConfig = {};
    readonly issuer: URL;

    constructor(issuer: string | URL, readonly clientId: string, config: OpenIDClientServiceConfig = {}) {
        this.#init = config;
        this.issuer = new URL(issuer);
    }

    async onModuleInit() {
        // discover
        this.#conf = await discovery(
            this.issuer,
            this.clientId,
            this.#init.discoveryOptions?.metadata,
            this.#init.discoveryOptions?.clientAuthentication,
            this.#init.discoveryOptions?.options
        );
        // create JWK Set func
        this.#keyFunc = createRemoteJWKSet(
            new URL(`${this.issuer}/.well-known/jwks.json`),
            this.#init.jwkSetOptions
        );
    }

    get #config() {
        if (!this.#conf) {
            throw new InternalServerErrorException("OIDC configuration is not initialized");
        }
        return this.#conf;
    }

    async refreshTokens(
        refreshToken: string,
        parameters?: URLSearchParams | Record<string, string>,
        options?: DPoPOptions
    ): Promise<TokenEndpointResponse & TokenEndpointResponseHelpers> {
        return refreshTokenGrant(this.#config, refreshToken, parameters, options);
    }

    buildLoginUrl(parameters: URLSearchParams | Record<string, string>): URL {
        return buildAuthorizationUrl(this.#config, parameters);
    }

    buildLogoutUrl(parameters?: URLSearchParams | Record<string, string>): URL {
        return buildEndSessionUrl(this.#config, parameters);
    }

    /**
     * Verifies a JWT.
     */
    async validateToken(token: string, options: JWTVerifyOptions): Promise<JWTVerifyResult<JWTPayload>> {
        if (!this.#keyFunc) {
            throw new InternalServerErrorException("JWK not initialized");
        }
        const key = await this.#keyFunc();

        if (!key) {
            throw new InternalServerErrorException("Failed to retrieve JWK");
        }

        return jwtVerify(token, key, options);
    }

    /**
     * @param currentUrl The current URL including the code query parameter.
     */
    async retrieveTokens(
        currentUrl: string | URL,
        checks?: AuthorizationCodeGrantChecks,
        parameters?: URLSearchParams | Record<string, string>,
        options?: AuthorizationCodeGrantOptions
    ): Promise<TokenEndpointResponse & TokenEndpointResponseHelpers> {
        const tokenSet = authorizationCodeGrant(
            this.#config,
            new URL(currentUrl),
            checks,
            parameters,
            options
        );
        return tokenSet;
    }
}
