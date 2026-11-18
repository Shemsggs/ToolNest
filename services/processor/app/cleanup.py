"""Remove expired private files and finalize eligible account deletions."""

from datetime import datetime, timedelta, timezone
import logging
import os

from supabase import Client, create_client

log = logging.getLogger('toolnest-cleanup')


def cleanup(db: Client) -> int:
    now = datetime.now(timezone.utc)
    retry_at = (now + timedelta(minutes=10)).isoformat()
    failures = files_removed = accounts_deleted = 0
    records = db.table('job_files').select('id,storage_path').lte('expires_at', now.isoformat()) \
        .lte('cleanup_after', now.isoformat()).order('expires_at').order('id').limit(100).execute().data
    storage = db.storage.from_('temporary-files')
    for record in records:
        try:
            storage.remove([record['storage_path']])
            db.table('job_files').delete().eq('id', record['id']).execute()
            files_removed += 1
        except Exception:
            failures += 1
            db.table('job_files').update({'cleanup_after': retry_at}).eq('id', record['id']).execute()

    accounts = db.rpc('toolnest_accounts_ready_for_deletion', {}).execute().data
    for account in accounts:
        user_id = account['user_id']
        try:
            db.auth.admin.delete_user(user_id)
            accounts_deleted += 1
        except Exception:
            failures += 1
            db.table('account_deletion_requests').update({'retry_after': retry_at}).eq('user_id', user_id).execute()

    log.info('Cleanup removed %d file records and %d accounts. Failed operations: %d.', files_removed, accounts_deleted, failures)
    return failures


def run() -> int:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    try:
        db = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
        return int(cleanup(db) > 0)
    except Exception:
        log.error('Cleanup could not reach the data service')
        return 1


if __name__ == '__main__':
    raise SystemExit(run())
