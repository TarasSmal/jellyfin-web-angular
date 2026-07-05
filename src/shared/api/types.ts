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

/**
 * POST /Users/{id}/Policy replaces the whole policy, so edits must round-trip
 * every field the server sent — hence the index signature.
 */
export interface UserPolicy {
  IsAdministrator?: boolean;
  IsDisabled?: boolean;
  IsHidden?: boolean;
  EnableRemoteAccess?: boolean;
  EnableAllFolders?: boolean;
  /** Library folder ids (VirtualFolderInfo.ItemId) when EnableAllFolders is off. */
  EnabledFolders?: string[];
  EnableMediaPlayback?: boolean;
  EnableAudioPlaybackTranscoding?: boolean;
  EnableVideoPlaybackTranscoding?: boolean;
  EnablePlaybackRemuxing?: boolean;
  EnableContentDeletion?: boolean;
  EnableContentDownloading?: boolean;
  EnableCollectionManagement?: boolean;
  EnableSubtitleManagement?: boolean;
  EnableSharedDeviceControl?: boolean;
  EnableRemoteControlOfOtherUsers?: boolean;
  EnableLiveTvAccess?: boolean;
  EnableLiveTvManagement?: boolean;
  /** Rating threshold from /Localization/ParentalRatings; null = no limit. */
  MaxParentalRating?: number | null;
  /** 0 = unlimited. */
  MaxActiveSessions?: number;
  [key: string]: unknown;
}

export interface ParentalRating {
  Name: string;
  Value?: number | null;
}

/** /Localization/Options — display languages. */
export interface LocalizationOption {
  Name: string;
  Value: string;
}

/** /Localization/Cultures — metadata languages. */
export interface CultureDto {
  DisplayName: string;
  TwoLetterISOLanguageName: string;
}

/** /Localization/Countries. */
export interface CountryInfo {
  DisplayName: string;
  TwoLetterISORegionName: string;
}

/**
 * POST /System/Configuration replaces the whole config, so edits must
 * round-trip every field the server sent — hence the index signature.
 */
export interface ServerConfiguration {
  ServerName?: string;
  UICulture?: string;
  QuickConnectAvailable?: boolean;
  EnableFolderView?: boolean;
  PreferredMetadataLanguage?: string;
  MetadataCountryCode?: string;
  MinResumePct?: number;
  MaxResumePct?: number;
  MinResumeDurationSeconds?: number;
  /** Bits per second; 0 = unlimited. */
  RemoteClientBitrateLimit?: number;
  EnableGroupingMoviesIntoCollections?: boolean;
  EnableGroupingShowsIntoCollections?: boolean;
  DisplaySpecialsWithinSeasons?: boolean;
  ActivityLogRetentionDays?: number | null;
  LogFileRetentionDays?: number;
  [key: string]: unknown;
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string;
  HasPassword?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: UserPolicy;
}

export interface AuthenticationResult {
  User: UserDto;
  AccessToken: string;
  ServerId: string;
}

export interface UserItemData {
  PlaybackPositionTicks?: number;
  PlayedPercentage?: number;
  Played?: boolean;
  IsFavorite?: boolean;
  UnplayedItemCount?: number;
}

export interface PersonDto {
  Id: string;
  Name: string;
  Role?: string;
  Type?: string;
  PrimaryImageTag?: string;
}

/** Embedded chapter metadata; present when the item is fetched with the Chapters field. */
export interface ChapterInfo {
  StartPositionTicks: number;
  Name?: string;
  ImageTag?: string;
}

/** Jellyfin models every media object with one DTO; Type discriminates. */
export interface BaseItemDto {
  People?: PersonDto[];
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode' | 'CollectionFolder' | (string & {});
  CollectionType?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Overview?: string;
  Genres?: string[];
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ImageBlurHashes?: Record<string, Record<string, string>>;
  PrimaryImageAspectRatio?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeriesPrimaryImageTag?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  IndexNumber?: number;
  ParentIndexNumber?: number;
  UserData?: UserItemData;
  Chapters?: ChapterInfo[];
}

export interface ItemsResult {
  Items: BaseItemDto[];
  TotalRecordCount: number;
}

/** Full system info from /System/Info — admin-only. */
export interface SystemInfo extends PublicSystemInfo {
  OperatingSystemDisplayName?: string;
  HasPendingRestart?: boolean;
  WebSocketPortNumber?: number;
}

export interface PlayState {
  PositionTicks?: number;
  IsPaused?: boolean;
  IsMuted?: boolean;
  PlayMethod?: 'Transcode' | 'DirectStream' | 'DirectPlay' | (string & {});
}

/** A device connected to the server, playing something or idle. */
export interface SessionInfo {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  ApplicationVersion?: string;
  RemoteEndPoint?: string;
  LastActivityDate?: string;
  NowPlayingItem?: BaseItemDto;
  PlayState?: PlayState;
  SupportsRemoteControl?: boolean;
}

export interface FolderStorageDto {
  Path: string;
  FreeSpace: number;
  UsedSpace: number;
  StorageType?: string;
  DeviceId?: string;
}

export interface LibraryStorageDto {
  Id: string;
  Name: string;
  Folders: FolderStorageDto[];
}

export interface SystemStorageDto {
  ProgramDataFolder?: FolderStorageDto;
  CacheFolder?: FolderStorageDto;
  LogFolder?: FolderStorageDto;
  InternalMetadataFolder?: FolderStorageDto;
  TranscodingTempFolder?: FolderStorageDto;
  Libraries?: LibraryStorageDto[];
}

export type TaskState = 'Idle' | 'Cancelling' | 'Running';

export interface TaskResult {
  StartTimeUtc?: string;
  EndTimeUtc?: string;
  Status?: 'Completed' | 'Failed' | 'Cancelled' | 'Aborted' | (string & {});
  ErrorMessage?: string;
}

export type CollectionTypeOption =
  'movies' | 'tvshows' | 'music' | 'musicvideos' | 'homevideos' | 'boxsets' | 'books' | 'mixed';

/** A library as configured on the server ("virtual folder"). */
export interface VirtualFolderInfo {
  Name: string;
  Locations: string[];
  CollectionType?: CollectionTypeOption;
  /** Id of the library's folder item — used for per-library refresh. */
  ItemId?: string;
  RefreshProgress?: number;
  RefreshStatus?: string;
}

export type PluginStatus =
  | 'Active'
  | 'Restart'
  | 'Deleted'
  | 'Superseded'
  | 'Superceded'
  | 'Malfunctioned'
  | 'NotSupported'
  | 'Disabled';

export interface PluginInfo {
  Id: string;
  Name: string;
  Version: string;
  Description?: string;
  CanUninstall?: boolean;
  Status?: PluginStatus;
}

/** NOTE: the packages API is camelCase on the wire, unlike everything else. */
export interface PackageVersionInfo {
  version: string;
  changelog?: string;
  targetAbi?: string;
  repositoryName?: string;
}

export interface PackageInfo {
  name: string;
  description?: string;
  overview?: string;
  owner?: string;
  category?: string;
  guid: string;
  versions: PackageVersionInfo[];
}

/** An issued access token — API keys have UserId unset. */
export interface AuthenticationInfo {
  Id: number;
  AccessToken: string;
  AppName?: string;
  DeviceName?: string;
  UserId?: string;
  UserName?: string;
  DateCreated?: string;
  DateLastActivity?: string;
}

export interface AuthenticationInfoResult {
  Items: AuthenticationInfo[];
  TotalRecordCount: number;
}

export interface DeviceInfoDto {
  Id: string;
  Name?: string;
  CustomName?: string;
  AppName?: string;
  AppVersion?: string;
  LastUserName?: string;
  DateLastActivity?: string;
}

export interface DevicesResult {
  Items: DeviceInfoDto[];
  TotalRecordCount: number;
}

export interface LogFile {
  Name: string;
  Size: number;
  DateCreated?: string;
  DateModified?: string;
}

export type LogSeverity = 'Trace' | 'Debug' | 'Information' | 'Warn' | 'Error' | 'Fatal';

export interface ActivityLogEntry {
  Id: number;
  Name: string;
  Overview?: string;
  ShortOverview?: string;
  Type: string;
  Date: string;
  Severity: LogSeverity;
  UserId?: string;
}

export interface ActivityLogResult {
  Items: ActivityLogEntry[];
  TotalRecordCount: number;
}

export interface TaskInfo {
  Id: string;
  Name: string;
  State: TaskState;
  /** Only present while the task is running. */
  CurrentProgressPercentage?: number;
  Description?: string;
  Category?: string;
  /** The socket feed includes hidden tasks; the REST call filters them. */
  IsHidden?: boolean;
  LastExecutionResult?: TaskResult;
}
