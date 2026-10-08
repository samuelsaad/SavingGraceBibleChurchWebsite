import type {Pool} from "pg";
/** Exact table privilege boundary for the staging CMS service; never a sermon writer. */
export async function verifyStagingCmsWriter(pool:Pool){
 const row=(await pool.query(`SELECT current_database() db,current_user role,
  current_setting('server_version_num')::int version,inet_server_port() port,
  (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls FROM pg_roles WHERE rolname=current_user) privileged,
  EXISTS(SELECT 1 FROM pg_auth_members WHERE member=current_user::regrole) membership,
  has_schema_privilege(current_user,'public','CREATE') schema_create,
  has_database_privilege(current_user,current_database(),'CREATE') database_create,
  EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=current_user::regrole) schema_owner,
  EXISTS(SELECT 1 FROM pg_class WHERE relowner=current_user::regrole) relation_owner,
  EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND has_table_privilege(current_user,c.oid,privilege)
   AND NOT(CASE c.relname
    WHEN 'cms_entities' THEN privilege IN ('SELECT','INSERT','UPDATE')
    WHEN 'cms_routes' THEN privilege IN ('SELECT','INSERT','UPDATE')
    WHEN 'cms_revisions' THEN privilege IN ('SELECT','INSERT')
    WHEN 'media_assets' THEN privilege IN ('SELECT','INSERT')
    WHEN 'audit_events' THEN privilege='INSERT'
    ELSE false END)) unexpected_privilege,
  EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND has_sequence_privilege(current_user,c.oid,'USAGE,SELECT,UPDATE')) sequence_privilege,
  NOT EXISTS(SELECT 1 FROM (VALUES ('cms_entities','SELECT'),('cms_entities','INSERT'),('cms_entities','UPDATE'),('cms_routes','SELECT'),('cms_routes','INSERT'),('cms_routes','UPDATE'),('cms_revisions','SELECT'),('cms_revisions','INSERT'),('media_assets','SELECT'),('media_assets','INSERT'),('audit_events','INSERT')) required(table_name,privilege) WHERE NOT has_table_privilege(current_user,table_name,privilege)) required_privileges`)).rows[0];
 if(!row||row.db!=="savinggrace_staging"||row.role!=="staging_cms_writer"||row.version<160000||row.version>=170000||row.port!==5432||!row.required_privileges
  ||["privileged","membership","schema_create","database_create","schema_owner","relation_owner","unexpected_privilege","sequence_privilege"].some(key=>row[key]))throw Error("cms_staging_writer_privileges_refused");
}
