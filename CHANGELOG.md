# Changelog

## [0.1.5](https://github.com/cellajs/raak/compare/0.1.4...0.1.5) (2026-08-07)


### 🐞 Bug fixes

* make pending backfill migrations survive prod RLS, add lost backfills ([#111](https://github.com/cellajs/raak/issues/111)) ([10a395c](https://github.com/cellajs/raak/commit/10a395ccbf2867188f0d0565be507eae31310996))

## [0.1.4](https://github.com/cellajs/raak/compare/0.1.3...0.1.4) (2026-08-07)


### 🐞 Bug fixes

* **infra:** adopt IAM model v2 stack config, add state-identity override ([#109](https://github.com/cellajs/raak/issues/109)) ([8c13f3a](https://github.com/cellajs/raak/commit/8c13f3a278fc5e89e1d8cf1204e3ce203d9fd052))


### 🧹 Chores

* retrigger release-please (push event dropped in Actions outage) ([f3bcd3f](https://github.com/cellajs/raak/commit/f3bcd3f16f4e943170d7ea48c07df408c5746ffa))

## [0.1.3](https://github.com/cellajs/raak/compare/0.1.2...0.1.3) (2026-08-06)


### 🐞 Bug fixes

* read empty boot-diag prefix as evidence, not a listing failure ([#107](https://github.com/cellajs/raak/issues/107)) ([b60bfa3](https://github.com/cellajs/raak/commit/b60bfa3c7fcdd039f46d1efae8cbc955a982f952))

## [0.1.2](https://github.com/cellajs/raak/compare/0.1.1...0.1.2) (2026-08-06)


### 🎉 New features

* primary labels table ([#104](https://github.com/cellajs/raak/issues/104)) ([6fd922a](https://github.com/cellajs/raak/commit/6fd922a2ed617f40bbf41b1199424401f30138f2))


### 🧹 Chores

* sync upstream cella v0.8.2 (83b95fb0) ([#106](https://github.com/cellajs/raak/issues/106)) ([855d7aa](https://github.com/cellajs/raak/commit/855d7aae410ca7e985acb75f5dc480d648b4541a))

## [0.1.1](https://github.com/cellajs/raak/compare/0.1.0...0.1.1) (2026-08-06)


### 🧹 Chores

* salvage seam housekeeping from [#99](https://github.com/cellajs/raak/issues/99) ([#102](https://github.com/cellajs/raak/issues/102)) ([d67a837](https://github.com/cellajs/raak/commit/d67a83792f9872e69dda142c38a4ad211ac5cdeb))
* sync upstream cella ([#98](https://github.com/cellajs/raak/issues/98)) ([3235a43](https://github.com/cellajs/raak/commit/3235a4348db87dd51d4abdddb0ec8e11b8784d34))
* sync upstream cella ff08151 ([8a5b585](https://github.com/cellajs/raak/commit/8a5b585dc6afa5d467e2e23c44096d27abc70380))
* sync upstream cella v0.8.1 (bbb9a42b) ([#101](https://github.com/cellajs/raak/issues/101)) ([466b7a3](https://github.com/cellajs/raak/commit/466b7a3beb34c91aad16e8ebdbdbb764dd40590b))
* sync upstream cella v0.8.2 (ccfe7df9) ([#103](https://github.com/cellajs/raak/issues/103)) ([1394d1c](https://github.com/cellajs/raak/commit/1394d1c65b24060d08b2cc1731040b0ef1139e41))
* sync with cella 0.7.0 (frontend placements, cella/ folder, IAM v2) ([#95](https://github.com/cellajs/raak/issues/95)) ([8a5b585](https://github.com/cellajs/raak/commit/8a5b585dc6afa5d467e2e23c44096d27abc70380))
* sync with cella upstream (82c76167..2e18afc1, 0.8.0) ([#100](https://github.com/cellajs/raak/issues/100)) ([4161cad](https://github.com/cellajs/raak/commit/4161cadbb3284d31480789bbcd5445accef16693))
* sync with cella upstream (ff08151a..82c76167) ([3235a43](https://github.com/cellajs/raak/commit/3235a4348db87dd51d4abdddb0ec8e11b8784d34))
* sync with cella upstream (ff08151a..82c76167) ([#97](https://github.com/cellajs/raak/issues/97)) ([4fec911](https://github.com/cellajs/raak/commit/4fec9114077c9a76c3d7b9aa60d2421d3a6e799d))

## [0.1.0](https://github.com/cellajs/raak/compare/0.0.9...0.1.0) (2026-07-30)


### ⚠ BREAKING CHANGES

* derive task.attachments from description media blocks, drop attachment.taskId ([#94](https://github.com/cellajs/raak/issues/94))
* **attachment:** collapse variant *Key columns into a single keys jsonb map ([#87](https://github.com/cellajs/raak/issues/87))
* label modes with per-org primary labels, epics data model, full lucide icon set ([#75](https://github.com/cellajs/raak/issues/75))

### 🎉 New features

* derive task.attachments from description media blocks, drop attachment.taskId ([#94](https://github.com/cellajs/raak/issues/94)) ([fd1733c](https://github.com/cellajs/raak/commit/fd1733c0931467b5bf3c2b1e246e4c01d11dc4a8))
* label modes with per-org primary labels, epics data model, full lucide icon set ([#75](https://github.com/cellajs/raak/issues/75)) ([9ac095f](https://github.com/cellajs/raak/commit/9ac095fa834e74ecc02934a8f71bcdcb90f8626e))


### 🐞 Bug fixes

* align docs for permissions ([416a2a7](https://github.com/cellajs/raak/commit/416a2a72c697e026110426f5e66b578db6480f9f))
* alignment fixes cella ([f36b684](https://github.com/cellajs/raak/commit/f36b684df77e6cc20317149065c7f00a22a7f7b7))
* **backend:** standardize schema validation contracts ([#85](https://github.com/cellajs/raak/issues/85)) ([f444530](https://github.com/cellajs/raak/commit/f4445304633e7dbf9b14c48503bff38df392d95b))
* description handling ([ea6fe89](https://github.com/cellajs/raak/commit/ea6fe89dc4642f897ba1dd121cbd8f628c068a57))
* draft visibility ([8471f2c](https://github.com/cellajs/raak/commit/8471f2c4ba4606e1129ff7c3be9349c506aebf40))
* tests ([b870c43](https://github.com/cellajs/raak/commit/b870c4347ba81d6cd6f0150bd2e65e255cffaba2))
* update cella.config.ts ([e1356c2](https://github.com/cellajs/raak/commit/e1356c2a2a4bf594ca1877b78689f32042b64c67))


### 🔧 Small improvements

* **attachment:** align Transloadit step names with variant vocabulary + fix seed/docs ([#88](https://github.com/cellajs/raak/issues/88)) ([1adbcb3](https://github.com/cellajs/raak/commit/1adbcb35f1b499706f824a3a5589eda34e58066e))
* **attachment:** collapse variant *Key columns into a single keys jsonb map ([#87](https://github.com/cellajs/raak/issues/87)) ([5267202](https://github.com/cellajs/raak/commit/5267202c84c92e98da6cc3df4e5e5f19f37ec4b0))
* **backend:** honest + deterministic module hub (defineBackendModule) ([#83](https://github.com/cellajs/raak/issues/83)) ([f75f5ab](https://github.com/cellajs/raak/commit/f75f5ab255e57fb14d29c3d6387ddd142f483af9))
* **backend:** module capability hub + synchronous mutation bus ([#81](https://github.com/cellajs/raak/issues/81)) ([e16bed3](https://github.com/cellajs/raak/commit/e16bed34b8e61132f1bb12664ef7a9ad974da6e9))
* **backend:** move task-delete attachment cascade into attachment-queries ([#82](https://github.com/cellajs/raak/issues/82)) ([cdbb5e1](https://github.com/cellajs/raak/commit/cdbb5e1651a59463d49e29797d1cb9056e522dac))
* **backend:** standardize query module conventions ([#84](https://github.com/cellajs/raak/issues/84)) ([0072a2d](https://github.com/cellajs/raak/commit/0072a2dd51a9a1a7787a80eafe0d13c86522bf41))
* **frontend:** align component and comment style ([#77](https://github.com/cellajs/raak/issues/77)) ([502ced5](https://github.com/cellajs/raak/commit/502ced5cf9a173ff26575b6dff31e27e2a66fae4))
* mocks ([e94157c](https://github.com/cellajs/raak/commit/e94157c60d2300e26e3a6b61d61df071c325043a))
* **publicat:** client-driven publicAt, drop project-inherit helper ([#90](https://github.com/cellajs/raak/issues/90)) ([5677541](https://github.com/cellajs/raak/commit/5677541c652815302c33ab11f1be6a0d0a3a1998))


### 🧹 Chores

* **cella:** shrink sync friction: pins/ignores, fork markers, cella-sync skill ([#92](https://github.com/cellajs/raak/issues/92)) ([8606d0a](https://github.com/cellajs/raak/commit/8606d0a89a834f77bbfaa2f6d0c6ea26acec5ee0))
* cleanup TODOS ([#86](https://github.com/cellajs/raak/issues/86)) ([ae877f9](https://github.com/cellajs/raak/commit/ae877f9bbad57082accf4a02e8aff5a79790e244))
* converge with cella after upstream raak-alignment (cella[#981](https://github.com/cellajs/raak/issues/981)) ([#93](https://github.com/cellajs/raak/issues/93)) ([3603d84](https://github.com/cellajs/raak/commit/3603d841410ee572b4ad4ee68372577c85c91750))
* converge with cella after upstream raak-alignment (cellajs/cella[#981](https://github.com/cellajs/raak/issues/981)) ([3603d84](https://github.com/cellajs/raak/commit/3603d841410ee572b4ad4ee68372577c85c91750))
* remove OperationRresult redundancy ([4b96d78](https://github.com/cellajs/raak/commit/4b96d7848282d359f7c004701be10a1899585d79))
* remove unused onboarding seed ([d22f133](https://github.com/cellajs/raak/commit/d22f1330ef7f8e8bccd3882982311989a014ca04))
* sync upstream cella v0.6.0 (e1a6ee5b) ([#80](https://github.com/cellajs/raak/issues/80)) ([fba4daa](https://github.com/cellajs/raak/commit/fba4daabecb626f8f024400bbeb741f6448e82ca))
* sync upstream cella v0.6.0 (e4fc8988) ([#78](https://github.com/cellajs/raak/issues/78)) ([d15cd12](https://github.com/cellajs/raak/commit/d15cd1212bce63fae3ac1bf15ebce0d96ceb2417))
* sync upstream cella v0.6.0 (edb112c2) ([#79](https://github.com/cellajs/raak/issues/79)) ([b1b8cea](https://github.com/cellajs/raak/commit/b1b8cea6d01adffc21f9afd5232875197b7a972e))
* sync upstream cella v0.6.1 (3829feb1) ([#91](https://github.com/cellajs/raak/issues/91)) ([8eec6f9](https://github.com/cellajs/raak/commit/8eec6f94d9679f59232f5ed8a62cd163bb9745ff))
* sync upstream cella v0.6.1 (42e4a651) ([#89](https://github.com/cellajs/raak/issues/89)) ([d71a458](https://github.com/cellajs/raak/commit/d71a458dc00dc21013d97ee035764eb88739c163))

## [0.0.9](https://github.com/cellajs/raak/compare/0.0.8...0.0.9) (2026-07-23)


### 🐞 Bug fixes

* degrade when live doesnt actually fetch the data but returns empty ([#68](https://github.com/cellajs/raak/issues/68)) ([31ed59a](https://github.com/cellajs/raak/commit/31ed59a642fc84098a602eb3c374130489e802f8))
* drizzle port mismatch ([2783678](https://github.com/cellajs/raak/commit/2783678659d21407be8729b76972392f9596f902))
* priotizer test drift ([c605141](https://github.com/cellajs/raak/commit/c6051418a37af12e03500d37b61156247f846289))
* **yjs:** materialize task descriptions as trusted server updates ([#64](https://github.com/cellajs/raak/issues/64)) ([d8837c6](https://github.com/cellajs/raak/commit/d8837c6febe757c0b2289c9daad6a9ffbe87b9c3))


### 🔧 Small improvements

* only count when necessary in product lists ([8b65720](https://github.com/cellajs/raak/commit/8b65720279d5cdffe9919d7421ad6bf3c5b18338))
* **sync:** scope delta fetches by projectId, drop the pathPrefix filter ([#65](https://github.com/cellajs/raak/issues/65)) ([31f0e3b](https://github.com/cellajs/raak/commit/31f0e3bf494a424a3b93d8bd9182b827eb0807fc))


### 🧹 Chores

* scopeChannelId -&gt; channelId ([#67](https://github.com/cellajs/raak/issues/67)) ([2ef80c8](https://github.com/cellajs/raak/commit/2ef80c888ba1074bd3728268f6595268157925fb))
* sync ([d1ee41d](https://github.com/cellajs/raak/commit/d1ee41db486286517e5c4dcecfaccc5d0ac0fec7))
* sync upstream cella ([#73](https://github.com/cellajs/raak/issues/73)) ([d1ee41d](https://github.com/cellajs/raak/commit/d1ee41db486286517e5c4dcecfaccc5d0ac0fec7))
* sync upstream cella v0.5.7 (32847feb) ([#71](https://github.com/cellajs/raak/issues/71)) ([2187ed1](https://github.com/cellajs/raak/commit/2187ed11fab69a7e27f994de27d105e3405d84bf))
* sync upstream cella v0.5.7 (baa38f0e) ([#70](https://github.com/cellajs/raak/issues/70)) ([d012bda](https://github.com/cellajs/raak/commit/d012bdad3cad3763570d12db107ce21c84bf7ada))
* sync upstream cella v0.5.7 (c908b990) ([#69](https://github.com/cellajs/raak/issues/69)) ([409608e](https://github.com/cellajs/raak/commit/409608e6b8169fe4f097c0aaa01fff978bd41d99))
* sync upstream cella v0.6.0 (c4a6d592) ([#74](https://github.com/cellajs/raak/issues/74)) ([9bec653](https://github.com/cellajs/raak/commit/9bec6536c1bbb5fa14dbadb2c37ceccdd5dc965f))

## [0.0.8](https://github.com/cellajs/raak/compare/0.0.7...0.0.8) (2026-07-22)


### 🐞 Bug fixes

* restore entity realtime + Yjs collaborative sync in production ([#62](https://github.com/cellajs/raak/issues/62)) ([81bbae1](https://github.com/cellajs/raak/commit/81bbae19ebca2e1a829b8192f91f54bddcd954ac))

## [0.0.7](https://github.com/cellajs/raak/compare/0.0.6...0.0.7) (2026-07-22)


### 🐞 Bug fixes

* rename product_counters.entity_type instead of unsafe ADD NOT NULL ([#60](https://github.com/cellajs/raak/issues/60)) ([5c27c0e](https://github.com/cellajs/raak/commit/5c27c0e4e5b2ac27eb6ce4411a98a2c32df6ac20))

## [0.0.6](https://github.com/cellajs/raak/compare/0.0.5...0.0.6) (2026-07-22)


### 🎉 New features

* start using docs site ([e32ccad](https://github.com/cellajs/raak/commit/e32ccad9d4169454be6b9bd999fa5d7558f991b4))


### 🐞 Bug fixes

* align config ([4231a15](https://github.com/cellajs/raak/commit/4231a15195365a68384de4d3c357528115974a90))


### 🧹 Chores

* sync upstream cella v0.5.6 (51e718ef) ([#58](https://github.com/cellajs/raak/issues/58)) ([6c5f2b0](https://github.com/cellajs/raak/commit/6c5f2b01a47f56e4b89a665b77eeeca02aeb069e))
* sync upstream cella v0.5.7 (4150f44c) ([#59](https://github.com/cellajs/raak/issues/59)) ([e00b846](https://github.com/cellajs/raak/commit/e00b8461e38a3cc7b4bf18e15ebf4d51804ab94b))

## [0.0.5](https://github.com/cellajs/raak/compare/0.0.4...0.0.5) (2026-07-20)


### 🐞 Bug fixes

* align config development ([7d7db73](https://github.com/cellajs/raak/commit/7d7db735a1b391cfea1943a20122753785bf20b1))


### 🧹 Chores

* alignment ([89deb8f](https://github.com/cellajs/raak/commit/89deb8f55e439b6acade0f7c40612231fdf6798d))
* sync upstream cella v0.5.2 (29da1502) ([#54](https://github.com/cellajs/raak/issues/54)) ([37fbe95](https://github.com/cellajs/raak/commit/37fbe95a2613a943866b8ae3e6f26aa9ccfcae96))
* sync upstream cella v0.5.5 (1b5ba354) ([#56](https://github.com/cellajs/raak/issues/56)) ([3c260de](https://github.com/cellajs/raak/commit/3c260decef11cfb859e293ffaebfec6dfc4affd0))

## [0.0.4](https://github.com/cellajs/raak/compare/0.0.3...0.0.4) (2026-07-20)


### 🐞 Bug fixes

* test ci fix ([98e719c](https://github.com/cellajs/raak/commit/98e719ce5c96edb11507ea35f42a7ffe0e04b59a))

## [0.0.3](https://github.com/cellajs/raak/compare/0.0.2...0.0.3) (2026-07-16)


### 🎉 New features

* absolute route paths for workspace and project modules ([#25](https://github.com/cellajs/raak/issues/25)) ([fde50ab](https://github.com/cellajs/raak/commit/fde50abcfd1e54c5356ae20c14d99cd4254db75d))
* **cdc:** deepest-non-null-ancestor context attribution — seq, counters, notifications, recalculation ([#32](https://github.com/cellajs/raak/issues/32)) ([71eabe6](https://github.com/cellajs/raak/commit/71eabe67573598eae67dc744613b313d22303527))
* data grid tile modes ([#17](https://github.com/cellajs/raak/issues/17)) ([e5ffd33](https://github.com/cellajs/raak/commit/e5ffd33a92a68c5caa03330e832054cb9b739a21))
* logging observability ([#15](https://github.com/cellajs/raak/issues/15)) ([f1bc3f7](https://github.com/cellajs/raak/commit/f1bc3f74d378f1a675617eddb367f09777c15248))
* relay-side description materialization — relay becomes single writer ([#25](https://github.com/cellajs/raak/issues/25)) ([#28](https://github.com/cellajs/raak/issues/28)) ([4ab5cd0](https://github.com/cellajs/raak/commit/4ab5cd0b08fb7d9ed792bb6ea2f14c35dc49ed12))
* Row policies + hostEntity: engine-level row visibility and product-to-product ownership ([#26](https://github.com/cellajs/raak/issues/26)) ([1d78c7f](https://github.com/cellajs/raak/commit/1d78c7f71a16b1dc8da8c0d0d2b655903eec18e1))
* seq-keyset reads for canonical hydration and delta sync ([#19](https://github.com/cellajs/raak/issues/19)) ([f0bd7f4](https://github.com/cellajs/raak/commit/f0bd7f441d79f757926c07e0db474485fa1182b0))


### 🐞 Bug fixes

* **task:** bug batch from module review ([#33](https://github.com/cellajs/raak/issues/33)) ([e9dff38](https://github.com/cellajs/raak/commit/e9dff3866bae81e4a73a6d3feebc3b282dbc8a49))
* tests ([#18](https://github.com/cellajs/raak/issues/18)) ([1ac5a89](https://github.com/cellajs/raak/commit/1ac5a89495afe72436cc9021a34d322d43536c9d))
* workspaceID not necessary to compare agains in enrichment ([d6069ae](https://github.com/cellajs/raak/commit/d6069ae5ce5d34b035dd7163f940fd29492338fe))
* yjs undo ([622f304](https://github.com/cellajs/raak/commit/622f304706aaeb79120feffcd12dcdc3814dd70a))


### 🔧 Small improvements

* de-host attachments — taskId is plain data, cascade is expl… ([#45](https://github.com/cellajs/raak/issues/45)) ([6f795a3](https://github.com/cellajs/raak/commit/6f795a3b54363a1e62ee289a8267010677faefa1))
* de-host attachments — taskId is plain data, cascade is explicit ([6f795a3](https://github.com/cellajs/raak/commit/6f795a3b54363a1e62ee289a8267010677faefa1))
* named exports migration ([#24](https://github.com/cellajs/raak/issues/24)) ([305fa6e](https://github.com/cellajs/raak/commit/305fa6e79917773799b510b352b25d94a2cb7539))
* **task:** module baseline cleanup (Phases 2–8) ([#39](https://github.com/cellajs/raak/issues/39)) ([34058fb](https://github.com/cellajs/raak/commit/34058fb0a0d1028499a49e316691c087d1aaa984))
* yjs/BlockNote/task-state cleanup + server-side Y.Doc seeding ([#27](https://github.com/cellajs/raak/issues/27)) ([95dc658](https://github.com/cellajs/raak/commit/95dc65879631bf88545879fd6c08418131084ff0))


### 📖 Documentation

* align remaining references with relay-side materialization ([#29](https://github.com/cellajs/raak/issues/29)) ([f6b586d](https://github.com/cellajs/raak/commit/f6b586dcae9f4df55e2a90efbe7ad8d40d6d7df0))

## [0.0.2](https://github.com/cellajs/raak/compare/0.0.1...0.0.2) (2026-07-05)


### 🎉 New features

* cella cli improvents ([585394e](https://github.com/cellajs/raak/commit/585394e8ed09602d9ce943155415a5c54cc97f17))
* cella sync ([#2](https://github.com/cellajs/raak/issues/2)) ([cb4ec7b](https://github.com/cellajs/raak/commit/cb4ec7b4251a0550902999e03580892c67e9d6b1))


### 🐞 Bug fixes

* cli ([9c6dc9e](https://github.com/cellajs/raak/commit/9c6dc9ed9427cf4f4121301ac4aded073c2fa7d0))
* many fixes ([4d13422](https://github.com/cellajs/raak/commit/4d13422ee772e3a178b3f8ae634d6d1bc0df73b4))
* stable task search ([20b6bb4](https://github.com/cellajs/raak/commit/20b6bb44efce93b083d187aba7b5c1257c0b9c69))
* use new location test-db file ([477e197](https://github.com/cellajs/raak/commit/477e19705d564f0ead682ca1b886da907f1afe14))
