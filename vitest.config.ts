import {configDefaults,defineConfig} from 'vitest/config';
/** Private evidence/release archives are never application test inputs. */
export default defineConfig({test:{maxWorkers:4,exclude:[...configDefaults.exclude,'private/**','migration-inputs/**','migration-exports/**']}});
