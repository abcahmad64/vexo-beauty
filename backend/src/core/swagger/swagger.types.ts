export interface SwaggerRuntimeConfig {
  readonly enabled: boolean;
  readonly path: string;
  readonly jsonPath: string;
  readonly yamlPath: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly serverUrl: string;
  readonly bearerAuthName: string;
  readonly persistAuthorization: boolean;
  readonly explorer: boolean;
}

export interface SwaggerSetupResult {
  readonly enabled: boolean;
  readonly path: string;
  readonly jsonPath: string;
  readonly yamlPath: string;
}
