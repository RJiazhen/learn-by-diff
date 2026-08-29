# LCP v1 field reference (for generators)

## `course.yml`

| Field               | Required | Notes                                                        |
| ------------------- | -------- | ------------------------------------------------------------ |
| `protocolVersion`   | yes      | Must be `1`                                                  |
| `id`                | yes      | Stable id; default learning folder name                      |
| `title`             | yes      | Display name                                                 |
| `source.repository` | yes      | Git URL or path; relative paths resolve from the course repo |
| `source.root`       | no       | Prefix joined in front of every chapter `fromDir` / `toDir`  |
| `workspace.install` | yes      | Shell command                                                |
| `workspace.dev`     | yes      | Shell command                                                |
| `workspace.test`    | yes      | Shell command                                                |

## `chapters/*.yml`

No field is required in the YAML file.

| Field        | Default                                                     | Notes                                                    |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| `id`         | filename without numeric prefix (`001-hello.yml` → `hello`) | Unique within the course                                 |
| `title`      | same as `id`                                                | Display name                                             |
| `fromDir`    | `""` (empty tree)                                           | Start snapshot under source (or `source.root`)           |
| `toDir`      | `""` (empty tree)                                           | Goal snapshot; empty = no implementation target          |
| `entryFiles` | auto (all files under `toDir`)                              | Optional explicit list relative to the chapter tree root |

Load order = chapter **file name** sort order. There is no `tests` field yet.

## Schema

JSON Schema: `packages/protocol/schema.json` (`$defs/course`, `$defs/chapter`).
