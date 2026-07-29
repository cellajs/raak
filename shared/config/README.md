# shared/config

## Access policies: elevation vs. self rows

Policies define CRUD permissions per role within each context. Values: `1` = allowed, `0` = denied, `'own'` = allowed only for the entity's creator. Any action omitted defaults to `0` (denied), so a row only needs to list the actions it grants.

`'own'` scopes a grant to the implicit owner relation: the engine allows the action only when `entity.createdBy === userId`. Use it for actions a role may take on rows it created but not on others' (e.g. `attachment` under `organization`, where a member can `read: 'own'` their own uploads but not the whole org's).

For a context entity (organization, workspace, project), its policy has two kinds of rows:

- **Elevation** rows on an ancestor context (e.g. `organization.*` under `project`): what a member of the parent can do to children. `create` lives here, it grants making the child.
- **Self** rows on the same context (e.g. `project.*` under `project`): what a member of the entity can do to that entity. `create` is omitted on self rows because you can't create an entity from inside itself.

Product entities have no self rows: their context rows are home rows, where `create` is meaningful (it grants creating the product inside that context).

## Adding new entities

Defining access policies (a `case` in the `permissions-config.ts` switch) is only one step of adding an entity. For the full end-to-end recipe (hierarchy declaration, config arrays, DB table + RLS, module wiring, sync engine, and frontend registration), see `cella/ADD_ENTITY.md`.
