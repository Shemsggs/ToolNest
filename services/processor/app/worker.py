"""Manage leased jobs and run PDF conversion in a bounded child process."""

import logging
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from typing import Any
import uuid

from supabase import Client, create_client

from app.converter import CONVERTER_ERRORS, MAX_BYTES, ConversionError

log = logging.getLogger('toolnest-worker')


class LeaseLost(Exception):
    pass


def convert(paths: list[Path], output: Path) -> None:
    script = Path(__file__).with_name('converter.py').resolve()
    environment = {key: os.environ[key] for key in ('SYSTEMROOT', 'WINDIR') if key in os.environ}
    try:
        result = subprocess.run(
            [sys.executable, '-I', str(script), str(output), *map(str, paths)],
            cwd=output.parent,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=45,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise ConversionError('CONVERSION_TIMEOUT') from error
    if result.returncode:
        raise ConversionError(CONVERTER_ERRORS.get(result.returncode, 'CONVERSION_FAILED'))


def process_job(db: Client, job: dict[str, Any]) -> None:
    job_id = job['id']
    lease = {'p_job_id': job_id, 'p_worker_id': job['worker_id']}

    def renew() -> None:
        if not db.rpc('renew_toolnest_lease', lease).execute().data:
            raise LeaseLost

    if job['tool_slug'] != 'merge-pdf':
        raise ConversionError('UNSUPPORTED_TOOL')
    records = db.table('job_files').select('storage_path,size_bytes').eq('job_id', job_id).eq('kind', 'input') \
        .order('input_position', nullsfirst=False).order('created_at').order('id').execute().data
    if not 2 <= len(records) == job['input_file_count'] <= 10:
        raise ConversionError('INCOMPLETE_UPLOAD')

    storage = db.storage.from_('temporary-files')
    with TemporaryDirectory(prefix='toolnest-') as workspace:
        paths = []
        for position, record in enumerate(records):
            renew()
            if not 0 < record['size_bytes'] <= MAX_BYTES:
                raise ConversionError('SIZE_MISMATCH')
            body = storage.download(record['storage_path'])
            if len(body) != record['size_bytes']:
                raise ConversionError('SIZE_MISMATCH')
            path = Path(workspace) / f'{position}.pdf'
            path.write_bytes(body)
            paths.append(path)

        renew()
        output = Path(workspace) / 'merged.pdf'
        convert(paths, output)
        size = output.stat().st_size
        if not 0 < size <= MAX_BYTES:
            raise ConversionError('OUTPUT_TOO_LARGE')
        renew()
        path = db.rpc('stage_toolnest_output', {**lease, 'p_size': size}).execute().data
        if not path:
            raise LeaseLost
        with output.open('rb') as stream:
            storage.upload(path, stream, {'content-type': 'application/pdf', 'upsert': 'false'})
        if not db.rpc('finish_toolnest_job', {**lease, 'p_path': path}).execute().data:
            raise LeaseLost


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    db = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    while True:
        worker_id = f'claim-{uuid.uuid4()}'
        try:
            claimed = db.rpc('claim_toolnest_job', {'p_worker_id': worker_id}).execute().data
            if not claimed:
                time.sleep(3)
                continue
            job = claimed[0]
            try:
                process_job(db, job)
                log.info('Job completed: %s', job['id'])
            except LeaseLost:
                log.info('Job lease ended: %s', job['id'])
            except Exception as error:
                invalid_input = isinstance(error, ConversionError)
                code = str(error) if invalid_input else 'PROCESSING_FAILED'
                log.warning('Job attempt failed: %s (%s)', job['id'], code)
                db.rpc('fail_toolnest_job', {
                    'p_job_id': job['id'], 'p_worker_id': worker_id, 'p_code': code, 'p_retry': not invalid_input,
                }).execute()
        except Exception:
            log.error('Worker queue request failed')
            time.sleep(5)


if __name__ == '__main__':
    run()
