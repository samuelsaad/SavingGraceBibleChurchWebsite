/// <reference types="astro/client" />

declare module "pgpass" {
  type ConnectionInfo = {
    host: string;
    port: string;
    database: string;
    user: string;
  };
  const pgPass: (
    connectionInfo: ConnectionInfo,
    callback: (password: string | undefined) => void
  ) => void;
  export default pgPass;
}
