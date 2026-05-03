/**
 * perry/compose — TypeScript bindings for perry-container-compose
 *
 * Strongly-typed compose-spec (v1.x) bindings. Mirrors
 * https://github.com/compose-spec/compose-spec field by field.
 *
 * Where compose-spec accepts "string OR long-form object", these
 * bindings expose a discriminated union — TS narrows on shape so the
 * long form gets full autocomplete without losing the short form's
 * brevity.
 *
 * @module perry/compose
 */

import { ContainerInfo, ContainerLogs } from "perry/container";

// ════════════════════════════════════════════════════════════════════
// Reference / utility types
// ════════════════════════════════════════════════════════════════════

/**
 * Go-duration string accepted by compose-spec for every time field.
 * Examples: `"30s"`, `"2m"`, `"1h30m"`, `"500ms"`.
 *
 * Typed as a plain `string` (not branded) so copy-paste from
 * docker-compose.yml works without casts. Validation happens at the
 * engine boundary; an unparseable duration fails `up()` with a
 * descriptive error rather than silently coercing.
 */
export type Duration = string;

/**
 * Image reference. Free-form string by spec — anything the backend
 * accepts (`alpine`, `nginx:1.27`, `cgr.dev/chainguard/static@sha256:...`,
 * `localhost:5000/svc:dev`).
 *
 * Not validated at compile time; template-literal-typing this would
 * reject valid shorthand like bare `"alpine"`.
 */
export type ImageRef = string;

/**
 * Compose-spec `list_or_dict` — environment, labels, sysctls,
 * extra_hosts, build.args all share this shape.
 *
 * Dict form is preferred (no `KEY=value` parsing); list form is for
 * pass-through to KEY=VALUE-style backends. The `null` value in dict
 * form means "inherit from host process env" (compose-spec §interpolation).
 */
export type ListOrDict =
  | Record<string, string | number | boolean | null>
  | string[];

export type StringOrList = string | string[];

// ════════════════════════════════════════════════════════════════════
// Service sub-types
// ════════════════════════════════════════════════════════════════════

/** compose-spec §service.build — string shorthand or full object */
export type BuildSpec = string | BuildConfig;

export interface BuildConfig {
  /** Build context directory (relative to compose file) */
  context?: string;
  /** Path to Containerfile / Dockerfile */
  dockerfile?: string;
  /** Inline Dockerfile content (compose-spec >=2.20) */
  dockerfile_inline?: string;
  /** Build-time arguments */
  args?: ListOrDict;
  /** SSH agent forwarding */
  ssh?: string[];
  /** Labels to add to the built image */
  labels?: ListOrDict;
  /** Cache sources (BuildKit) */
  cache_from?: string[];
  /** Cache export targets (BuildKit) */
  cache_to?: string[];
  /** Bypass image cache */
  no_cache?: boolean;
  /** Named build contexts (BuildKit) */
  additional_contexts?: Record<string, string>;
  /** Network for build steps */
  network?: string;
  /** Always pull base images */
  pull?: boolean;
  /** Multi-stage build target */
  target?: string;
  /** /dev/shm size during build */
  shm_size?: string | number;
  /** Custom /etc/hosts entries during build */
  extra_hosts?: ListOrDict;
  /** Container isolation tech (Windows: process / hyperv) */
  isolation?: string;
  /** Privileged build */
  privileged?: boolean;
  /** Build secrets (compose-spec build.secrets) */
  secrets?: string[];
  /** Tag the built image */
  tags?: string[];
  /** Multi-arch platforms (`linux/amd64`, `linux/arm64/v8`) */
  platforms?: string[];
  /** Buildx entitlements (`security.insecure`, `network.host`) */
  entitlements?: string[];
}

/**
 * Healthcheck `test` field — discriminated tuple.
 *
 *   `["NONE"]`         — disable image's own healthcheck
 *   `["CMD", ...]`     — exec form, no shell
 *   `["CMD-SHELL", x]` — shell form (`/bin/sh -c x`)
 */
export type HealthcheckTest =
  | readonly ["NONE"]
  | readonly ["CMD", string, ...string[]]
  | readonly ["CMD-SHELL", string];

export interface Healthcheck {
  test?: HealthcheckTest;
  interval?: Duration;
  timeout?: Duration;
  retries?: number;
  start_period?: Duration;
  /** compose-spec >=2.20 — interval used during start_period */
  start_interval?: Duration;
  disable?: boolean;
}

// ───── Ports ─────

export type PortProtocol = "tcp" | "udp" | "sctp";
export type PortMode = "host" | "ingress";

/**
 * Short-form port. Compose-spec accepts:
 *   `"80"`              — container 80, host auto
 *   `"8080:80"`         — host 8080 → container 80
 *   `"8080:80/udp"`     — with protocol
 *   `"127.0.0.1:8080:80"` — bind to specific host IP
 *   `"3000-3005:3000-3005"` — range
 *   `80` (number)       — container 80, host auto
 */
export type ShortPort = string | number;

export interface LongPort {
  /** compose-spec >=2.x: human-friendly name */
  name?: string;
  /** Container-side port */
  target: number;
  /** Host-side port (or range like `"30000-30005"`) */
  published?: number | string;
  /** Bind-to host IP */
  host_ip?: string;
  protocol?: PortProtocol;
  /** Application-layer protocol hint (`http`, `grpc`) */
  app_protocol?: string;
  mode?: PortMode;
}

export type PortEntry = ShortPort | LongPort;

// ───── Volumes (per-service mounts) ─────

export type VolumeMountType =
  | "bind"
  | "volume"
  | "tmpfs"
  | "cluster"
  | "npipe"
  | "image";

export interface VolumeBindOptions {
  propagation?:
    | "rprivate"
    | "private"
    | "rshared"
    | "shared"
    | "rslave"
    | "slave";
  create_host_path?: boolean;
  /** Recursive bind: `enabled` / `disabled` / `writable` / `readonly` */
  recursive?: "enabled" | "disabled" | "writable" | "readonly";
  /** SELinux relabel: `z` (shared) / `Z` (private) */
  selinux?: "z" | "Z";
}

export interface VolumeOptions {
  labels?: ListOrDict;
  nocopy?: boolean;
  /** Sub-path inside the named volume to mount */
  subpath?: string;
}

export interface TmpfsOptions {
  /** Size in bytes (number) or with suffix (`"64m"`) */
  size?: number | string;
  /** Octal mode like 0o1777 */
  mode?: number;
}

export interface ImageVolumeOptions {
  subpath?: string;
}

export interface LongVolume {
  type: VolumeMountType;
  /** Named-volume name OR host path for bind */
  source?: string;
  /** Container path */
  target?: string;
  read_only?: boolean;
  /** macOS Docker: `consistent` / `cached` / `delegated` (no-op elsewhere) */
  consistency?: "consistent" | "cached" | "delegated";
  bind?: VolumeBindOptions;
  volume?: VolumeOptions;
  tmpfs?: TmpfsOptions;
  image?: ImageVolumeOptions;
}

/**
 * Short form: `"named:/in/container"`, `"./host:/in/container:ro"`,
 * `"/abs/host:/in/container"`. Long form: full `LongVolume` object.
 */
export type VolumeEntry = string | LongVolume;

// ───── Networks (per-service attachments) ─────

export interface ServiceNetworkConfig {
  /** Additional DNS names this service is reachable as */
  aliases?: string[];
  ipv4_address?: string;
  ipv6_address?: string;
  /** Lower number = preferred default route */
  priority?: number;
  /** compose-spec >=2.24 — gateway-priority on this network */
  gw_priority?: number;
  /** Per-attachment driver opts */
  driver_opts?: Record<string, string>;
  /** Per-attachment MAC address */
  mac_address?: string;
  /** Link-local IP addresses */
  link_local_ips?: string[];
}

export type ServiceNetworks =
  | string[]
  | Record<string, ServiceNetworkConfig | null>;

// ───── depends_on ─────

export type DependsOnCondition =
  | "service_started"
  | "service_healthy"
  | "service_completed_successfully";

export interface DependsOnEntry {
  condition?: DependsOnCondition;
  /** Required for the dependent to start (compose-spec >=2.20). Default true. */
  required?: boolean;
  /** Restart dependent when this one restarts. Default false. */
  restart?: boolean;
}

export type DependsOn = string[] | Record<string, DependsOnEntry>;

// ───── Logging ─────

/**
 * Well-known log drivers; the `(string & {})` tail keeps autocomplete
 * for these values without rejecting third-party driver plugins.
 */
export type LoggingDriver =
  | "none"
  | "local"
  | "json-file"
  | "syslog"
  | "journald"
  | "gelf"
  | "fluentd"
  | "awslogs"
  | "splunk"
  | "etwlogs"
  | "gcplogs"
  | (string & {});

export interface Logging {
  driver?: LoggingDriver;
  options?: Record<string, string | number>;
}

// ───── Deploy ─────

export type DeployMode = "global" | "replicated";
export type RestartCondition = "none" | "on-failure" | "any";
export type UpdateOrder = "stop-first" | "start-first";
export type EndpointMode = "vip" | "dnsrr";

export interface Resources {
  cpus?: string | number;
  memory?: string;
  pids?: number;
  /** compose-spec >=2.x — generic resources (kind/value pairs) */
  generic_resources?: GenericResource[];
  /** compose-spec >=2.x — per-device reservations (e.g. NVIDIA GPUs) */
  devices?: ResourceDevice[];
}

export interface GenericResource {
  discrete_resource_spec?: { kind: string; value: number };
}

export interface ResourceDevice {
  capabilities: string[];
  driver?: string;
  count?: number | "all";
  device_ids?: string[];
  options?: Record<string, string>;
}

export interface DeployRestartPolicy {
  condition?: RestartCondition;
  delay?: Duration;
  max_attempts?: number;
  window?: Duration;
}

export interface DeployUpdateConfig {
  parallelism?: number;
  delay?: Duration;
  failure_action?: "continue" | "rollback" | "pause";
  monitor?: Duration;
  max_failure_ratio?: number;
  order?: UpdateOrder;
}

export interface DeployPlacement {
  constraints?: string[];
  preferences?: { spread: string }[];
  max_replicas_per_node?: number;
}

export interface Deploy {
  mode?: DeployMode;
  replicas?: number;
  labels?: ListOrDict;
  resources?: { limits?: Resources; reservations?: Resources };
  restart_policy?: DeployRestartPolicy;
  placement?: DeployPlacement;
  update_config?: DeployUpdateConfig;
  rollback_config?: DeployUpdateConfig;
  endpoint_mode?: EndpointMode;
}

// ───── Lifecycle hooks (compose-spec >=2.30) ─────

export interface LifecycleHook {
  command: string | string[];
  user?: string;
  privileged?: boolean;
  working_dir?: string;
  environment?: ListOrDict;
}

// ───── Configs / Secrets (per-service mount references) ─────

export interface ServiceConfigOrSecret {
  source: string;
  target?: string;
  /** UID of the file inside the container */
  uid?: string;
  /** GID of the file inside the container */
  gid?: string;
  /** Octal file mode */
  mode?: number;
}

// ───── Develop (compose-spec >=2.22 watch) ─────

export interface DevelopWatch {
  action: "rebuild" | "sync" | "sync+restart" | "sync+exec";
  path: string;
  target?: string;
  ignore?: string[];
  exec?: { command: string | string[] };
}

export interface Develop {
  watch?: DevelopWatch[];
}

// ───── Misc enums / template-literal types ─────

export type RestartPolicyShort =
  | "no"
  | "always"
  | "on-failure"
  | "unless-stopped";

export type PullPolicy =
  | "always"
  | "never"
  | "missing"
  | "build"
  | "if_not_present"
  | "daily"
  | "weekly";

/**
 * `network_mode` — short string OR backend-aware variants.
 *   `"host"` / `"none"` / `"bridge"` — standard modes
 *   `"service:<name>"`  — share another service's net namespace
 *   `"container:<id>"`  — share a specific container's net namespace
 */
export type NetworkMode =
  | "host"
  | "none"
  | "bridge"
  | `service:${string}`
  | `container:${string}`;

export type IpcMode =
  | "none"
  | "host"
  | "private"
  | "shareable"
  | `service:${string}`
  | `container:${string}`;

export type PidMode = "host" | `container:${string}`;

// ───── env_file (compose-spec >=2.24 long form) ─────

export type EnvFileEntry = string | { path: string; required?: boolean };

// ════════════════════════════════════════════════════════════════════
// Service
// ════════════════════════════════════════════════════════════════════

export interface Service {
  // ───── Identity ─────
  image?: ImageRef;
  build?: BuildSpec;
  container_name?: string;
  hostname?: string;
  /** External DNS suffix appended to hostname */
  domainname?: string;
  /** Filter for `--profile` activation */
  profiles?: string[];
  /** Inherit from another service / file */
  extends?: string | { file?: string; service: string };
  /** Replicated service count (single-host short form) */
  scale?: number;

  // ───── Process ─────
  command?: string | string[];
  entrypoint?: string | string[];
  user?: string;
  working_dir?: string;
  stdin_open?: boolean;
  tty?: boolean;
  /** Override the default stop signal (`"SIGTERM"`, `"SIGINT"`) */
  stop_signal?: string;
  stop_grace_period?: Duration;
  /** Lifecycle hooks (compose-spec >=2.30) */
  post_start?: LifecycleHook[];
  pre_stop?: LifecycleHook[];

  // ───── Environment / config ─────
  environment?: ListOrDict;
  env_file?: string | EnvFileEntry[];
  labels?: ListOrDict;
  configs?: (string | ServiceConfigOrSecret)[];
  secrets?: (string | ServiceConfigOrSecret)[];

  // ───── Networking ─────
  ports?: PortEntry[];
  expose?: (string | number)[];
  networks?: ServiceNetworks;
  network_mode?: NetworkMode;
  ipc?: IpcMode;
  pid?: PidMode;
  dns?: StringOrList;
  dns_search?: StringOrList;
  dns_opt?: string[];
  extra_hosts?: ListOrDict;
  mac_address?: string;

  // ───── Storage ─────
  volumes?: VolumeEntry[];
  volumes_from?: string[];
  tmpfs?: StringOrList;
  /** /dev/shm size — number or `"64m"` */
  shm_size?: string | number;

  // ───── Lifecycle / health ─────
  depends_on?: DependsOn;
  restart?: RestartPolicyShort;
  healthcheck?: Healthcheck;
  pull_policy?: PullPolicy;
  /** Multi-arch — `"linux/amd64"`, `"linux/arm64/v8"` */
  platform?: string;

  // ───── Security ─────
  privileged?: boolean;
  read_only?: boolean;
  cap_add?: string[];
  cap_drop?: string[];
  security_opt?: string[];
  userns_mode?: string;
  /** Group additions (UID or name) */
  group_add?: (string | number)[];

  // ───── Resources (single-host short form — prefer `deploy.resources`) ─────
  cpus?: number | string;
  cpu_shares?: number;
  cpu_quota?: number;
  cpu_period?: number;
  cpu_rt_runtime?: number | string;
  cpu_rt_period?: number | string;
  cpuset?: string;
  mem_limit?: string | number;
  mem_reservation?: string | number;
  mem_swappiness?: number;
  memswap_limit?: string | number;
  oom_kill_disable?: boolean;
  oom_score_adj?: number;
  pids_limit?: number;

  // ───── Kernel ─────
  sysctls?: ListOrDict;
  ulimits?: Record<string, number | { soft: number; hard: number }>;
  init?: boolean;
  /** Override default cgroup parent */
  cgroup_parent?: string;
  cgroup?: "host" | "private";

  // ───── Observability / orchestration ─────
  logging?: Logging;
  deploy?: Deploy;
  develop?: Develop;
  annotations?: ListOrDict;
}

// ════════════════════════════════════════════════════════════════════
// Top-level entities
// ════════════════════════════════════════════════════════════════════

export interface NetworkIpamConfig {
  subnet?: string;
  ip_range?: string;
  gateway?: string;
  aux_addresses?: Record<string, string>;
}

export interface NetworkIpam {
  driver?: string;
  config?: NetworkIpamConfig[];
  options?: Record<string, string>;
}

export interface ComposeNetwork {
  name?: string;
  driver?: string;
  driver_opts?: Record<string, string>;
  ipam?: NetworkIpam;
  external?: boolean;
  /**
   * Internal-only network: containers attached can only reach other
   * containers on the same network — no external bridge / routing,
   * no host-network egress. Use this for the database side of a
   * web/db split so postgres etc. can't be reached from the host.
   */
  internal?: boolean;
  attachable?: boolean;
  enable_ipv4?: boolean;
  enable_ipv6?: boolean;
  labels?: ListOrDict;
}

export interface ComposeVolume {
  name?: string;
  driver?: string;
  driver_opts?: Record<string, string>;
  external?: boolean;
  labels?: ListOrDict;
}

export interface ComposeSecret {
  name?: string;
  /** Inline content via env var */
  environment?: string;
  /** Path on host */
  file?: string;
  external?: boolean;
  driver?: string;
  driver_opts?: Record<string, string>;
  labels?: ListOrDict;
  template_driver?: string;
}

export interface ComposeConfig {
  name?: string;
  /** Inline string content (compose-spec >=2.20) */
  content?: string;
  environment?: string;
  file?: string;
  external?: boolean;
  labels?: ListOrDict;
  template_driver?: string;
}

// ════════════════════════════════════════════════════════════════════
// Root spec
// ════════════════════════════════════════════════════════════════════

export interface IncludeEntry {
  path: string | string[];
  project_directory?: string;
  env_file?: string | string[];
}

export interface ComposeSpec {
  /** Spec version. Optional in compose-spec v2; informational only. */
  version?: string;
  /** Project name (default: directory name) */
  name?: string;
  services: Record<string, Service>;
  networks?: Record<string, ComposeNetwork | null>;
  volumes?: Record<string, ComposeVolume | null>;
  secrets?: Record<string, ComposeSecret>;
  configs?: Record<string, ComposeConfig>;
  /** Top-level inheritance (compose-spec >=2.20) */
  include?: (string | IncludeEntry)[];
}

// ════════════════════════════════════════════════════════════════════
// Handles + API
// ════════════════════════════════════════════════════════════════════

/**
 * Opaque handle to a running compose stack. Returned by `up()`,
 * accepted by every other API. Branded so a raw `number` can't be
 * passed accidentally.
 */
export type ComposeHandle = number & { readonly __brand: "ComposeHandle" };

export interface UpOptions {
  /** Start in detached mode (default: true) */
  detach?: boolean;
  /** Build images before starting */
  build?: boolean;
  /** Services to start (empty = all) */
  services?: string[];
  /** Remove orphaned containers */
  removeOrphans?: boolean;
  /** Activate the named compose-spec profiles */
  profiles?: string[];
}

export interface DownOptions {
  /** Remove named volumes */
  volumes?: boolean;
  /** Remove images on down (`local` = built only / `all` = pulled too) */
  rmi?: "local" | "all";
  /** Send timeout in seconds before SIGKILL */
  timeout?: number;
}

export interface LogsOptions {
  /** Service name to get logs from (optional) */
  service?: string;
  /** Number of lines to show from the end */
  tail?: number;
  /** Include timestamps in each line */
  timestamps?: boolean;
  /** Follow log output (returns when stream ends) */
  follow?: boolean;
  /** Show logs after this RFC3339 timestamp / Go-duration relative value */
  since?: string;
}

/**
 * Bring up services defined in a compose spec.
 * @param spec    Strongly-typed compose specification
 * @param options Optional `up` flags
 * @returns       Promise resolving to the stack handle
 */
export function up(
  spec: ComposeSpec,
  options?: UpOptions,
): Promise<ComposeHandle>;

/**
 * Stop and remove services in a stack.
 */
export function down(
  handle: ComposeHandle,
  options?: DownOptions,
): Promise<void>;

/**
 * List service statuses in a stack.
 *
 * @returns Promise resolving to a **JSON-encoded** {@link ContainerInfo}`[]`
 *   string. Call `JSON.parse(await ps(handle))` to recover the array.
 *   The JSON-string return shape reflects Perry's current FFI contract;
 *   server-side array-materialization is a planned ergonomics task.
 */
export function ps(handle: ComposeHandle): Promise<string>;

/**
 * Get logs from services in a stack.
 *
 * @returns Promise resolving to a **JSON-encoded** {@link ContainerLogs}
 *   string. Call `JSON.parse(await logs(handle, opts))` to recover
 *   `{ stdout, stderr }`.
 */
export function logs(
  handle: ComposeHandle,
  options?: LogsOptions,
): Promise<string>;

/**
 * Execute a command in a running service container within a stack.
 *
 * @returns Promise resolving to a **JSON-encoded** {@link ContainerLogs}
 *   string. Call `JSON.parse(await exec(handle, svc, cmd))` to recover
 *   `{ stdout, stderr }`.
 */
export function exec(
  handle: ComposeHandle,
  service: string,
  cmd: string[],
): Promise<string>;

/**
 * Get the resolved compose configuration as YAML.
 */
export function config(handle: ComposeHandle): Promise<string>;

/**
 * Start existing stopped services in a stack.
 */
export function start(
  handle: ComposeHandle,
  services?: string[],
): Promise<void>;

/**
 * Stop running services in a stack.
 */
export function stop(
  handle: ComposeHandle,
  services?: string[],
): Promise<void>;

/**
 * Restart services in a stack.
 */
export function restart(
  handle: ComposeHandle,
  services?: string[],
): Promise<void>;
