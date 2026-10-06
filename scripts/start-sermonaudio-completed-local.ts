/** Explicit D-175 opt-in, existing loopback development identity. No schema,
 * seeding, content import or review decision occurs during startup. */
process.env.D175_LOCAL_FRONTEND_ENABLED='1';
process.env.API_PORT??='4411';
await import('./start-admin-workbench-local');
export {};
