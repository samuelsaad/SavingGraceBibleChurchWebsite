import {correctiveAcceptanceSql} from '../../domain/local-corrective-review';
import {audioCohorts,type AudioCohort} from '../../domain/sermonaudio-review';
import {workbenchEligibilitySql} from './admin-workbench';
/** Opt-in local protected frontend only. Does not broaden any public/staging
 * selector or include earlier dashboard-only local completions. */
export function localCorrectiveFrontendSql(alias='s',testDatabaseName?:string) {
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('sql_alias_refused');
 const target=testDatabaseName&&/^savinggrace_test_run_[a-z0-9]{24,48}$/u.test(testDatabaseName)?testDatabaseName:'savinggrace_sermons_test';
 return `(current_database()='${target}' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432 AND (
 ${Object.keys(audioCohorts).map(c=>workbenchEligibilitySql(c as AudioCohort,alias)).join(' OR ')} OR ${correctiveAcceptanceSql(alias,testDatabaseName)}))`;
}
