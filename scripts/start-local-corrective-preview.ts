/** D-173 opt-in: existing development identity and authenticated preview only.
 * No migrations, seeding or content writes occur during server startup. */
process.env.D173_LOCAL_FRONTEND_ENABLED='1';
process.env.API_PORT ??='4410';
await import('./start-admin-workbench-local');
export {};
