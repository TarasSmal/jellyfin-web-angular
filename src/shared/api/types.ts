/**
 * Wire types for the Jellyfin HTTP API — hand-written per ADR 0002,
 * shapes cribbed from the server's OpenAPI spec. Only fields we use.
 */

export interface PublicSystemInfo {
  Id: string;
  ServerName: string;
  Version: string;
  ProductName?: string;
  LocalAddress?: string;
  StartupWizardCompleted?: boolean;
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string;
  Policy?: {
    IsAdministrator?: boolean;
  };
}

export interface AuthenticationResult {
  User: UserDto;
  AccessToken: string;
  ServerId: string;
}
