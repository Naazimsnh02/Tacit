alter table workflow_versions
  add column prompt_version text,
  add column model_role text;
