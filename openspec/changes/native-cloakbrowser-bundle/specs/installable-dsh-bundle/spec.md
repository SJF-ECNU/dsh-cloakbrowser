## ADDED Requirements

### Requirement: DSH bundle manifest
The repository SHALL provide an npm package manifest with `dsh.bundle.patch` and a patch file that inserts the native plugin row by package name.

#### Scenario: Profile installation
- **WHEN** a user runs `dsh plugin --profile <name> add <package>`
- **THEN** DSH SHALL discover the bundle patch and add the bundle layer to that profile

### Requirement: Publishable package contents
The npm package SHALL include only the JavaScript entry points, patch manifest, Python worker, README, and license assets required at runtime or for installation.

#### Scenario: Package contents check
- **WHEN** the maintainer runs `npm pack --dry-run`
- **THEN** the output SHALL include the bundle patch and Python worker
