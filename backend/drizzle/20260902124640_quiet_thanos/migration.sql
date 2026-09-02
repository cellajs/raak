ALTER TABLE "tenants" ALTER COLUMN "restrictions" SET DEFAULT '{"quotas":{"user":1000,"organization":1,"workspace":0,"project":0,"task":0,"label":0,"attachment":100},"rateLimits":{"apiPointsPerHour":1000}}';--> statement-breakpoint
CREATE INDEX "labels_project_id_index" ON "labels" ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_index" ON "tasks" ("project_id");