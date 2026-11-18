import io
from pathlib import Path
import subprocess
from unittest.mock import patch

import pytest
from pypdf import PdfReader, PdfWriter
from app.converter import ConversionError, merge_pdf_bytes
from app.worker import convert

def pdf():
    w=PdfWriter();w.add_blank_page(width=100,height=100);out=io.BytesIO();w.write(out);return out.getvalue()

def test_merges_two_pdfs():
    result=merge_pdf_bytes([pdf(),pdf()]);assert len(PdfReader(io.BytesIO(result)).pages)==2

def test_rejects_invalid_count():
    with pytest.raises(ValueError,match='INVALID_FILE_COUNT'):merge_pdf_bytes([pdf()])

def test_rejects_non_pdf():
    with pytest.raises(ValueError,match='INVALID_PDF'):merge_pdf_bytes([pdf(),b'no'])


def test_subprocess_preserves_input_order(tmp_path: Path):
    paths = []
    for width in (100, 200):
        writer = PdfWriter()
        writer.add_blank_page(width=width, height=100)
        path = tmp_path / f'{width}.pdf'
        writer.write(path)
        paths.append(path)
    output = tmp_path / 'merged.pdf'
    convert(paths, output)
    assert [page.mediabox.width for page in PdfReader(output).pages] == [100, 200]


def test_subprocess_does_not_receive_service_credentials(tmp_path: Path, monkeypatch):
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-not-a-credential')
    with patch('app.worker.subprocess.run', side_effect=subprocess.TimeoutExpired('converter', 45)) as run:
        with pytest.raises(ConversionError, match='CONVERSION_TIMEOUT'):
            convert([tmp_path / 'input.pdf'], tmp_path / 'merged.pdf')
    assert 'SUPABASE_SERVICE_ROLE_KEY' not in run.call_args.kwargs['env']
    assert run.call_args.kwargs['timeout'] == 45


def test_subprocess_rejects_invalid_pdf(tmp_path: Path):
    first = tmp_path / 'first.pdf'
    first.write_bytes(pdf())
    second = tmp_path / 'second.pdf'
    second.write_bytes(b'%PDF-1.7\ninvalid')
    output = tmp_path / 'merged.pdf'
    with pytest.raises(ConversionError, match='INVALID_PDF'):
        convert([first, second], output)
    assert not output.exists()
