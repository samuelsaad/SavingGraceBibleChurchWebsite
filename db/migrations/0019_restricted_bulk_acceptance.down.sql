BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sermon_restricted_acceptances) THEN
    RAISE EXCEPTION 'accepted_evidence_prevents_schema_rollback';
  END IF;
END $$;
DROP TRIGGER sermon_restricted_acceptance_withdrawals_immutable ON sermon_restricted_acceptance_withdrawals;
DROP TRIGGER sermon_restricted_acceptances_immutable ON sermon_restricted_acceptances;
DROP TABLE sermon_restricted_acceptance_withdrawals;
DROP TABLE sermon_restricted_acceptances;
DROP FUNCTION protect_restricted_acceptance_history();
DROP FUNCTION restricted_acceptance_dependency(uuid);
COMMIT;
