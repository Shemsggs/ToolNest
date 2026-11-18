"""Restricted subprocess entry point for PDF merge."""

import io
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import BinaryIO

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

MAX_PAGES = 200
MAX_BYTES = 25 * 1024 * 1024
CONVERTER_ERRORS = {
    10: 'INVALID_FILE_COUNT',
    11: 'INVALID_PDF',
    12: 'ENCRYPTED_PDF',
    13: 'PAGE_LIMIT',
    14: 'OUTPUT_TOO_LARGE',
    15: 'RESOURCE_LIMIT',
}


class ConversionError(ValueError):
    pass


class BoundedOutput(io.BytesIO):
    def write(self, data: bytes) -> int:
        if self.tell() + len(data) > MAX_BYTES:
            raise ConversionError('OUTPUT_TOO_LARGE')
        return super().write(data)


def merge_pdfs(inputs: Iterable[bytes], output: BinaryIO) -> None:
    writer = PdfWriter()
    pages = count = 0
    try:
        for raw in inputs:
            count += 1
            if count > 10:
                raise ConversionError('INVALID_FILE_COUNT')
            if not 0 < len(raw) <= MAX_BYTES or not raw.startswith(b'%PDF-'):
                raise ConversionError('INVALID_PDF')
            reader = PdfReader(io.BytesIO(raw), strict=True)
            if reader.is_encrypted:
                raise ConversionError('ENCRYPTED_PDF')
            pages += len(reader.pages)
            if pages > MAX_PAGES:
                raise ConversionError('PAGE_LIMIT')
            for page in reader.pages:
                writer.add_page(page)
        if not 2 <= count <= 10:
            raise ConversionError('INVALID_FILE_COUNT')
        if not pages:
            raise ConversionError('INVALID_PDF')
        writer.write(output)
    except (PyPdfError, RecursionError) as error:
        raise ConversionError('INVALID_PDF') from error


def merge_pdf_bytes(inputs: list[bytes]) -> bytes:
    if not 2 <= len(inputs) <= 10:
        raise ConversionError('INVALID_FILE_COUNT')
    output = BoundedOutput()
    merge_pdfs(inputs, output)
    return output.getvalue()


def run() -> int:
    if sys.platform.startswith('linux'):
        import resource

        memory = 512 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
        resource.setrlimit(resource.RLIMIT_CPU, (35, 40))
        resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

    try:
        inputs = [Path(arg) for arg in sys.argv[2:]]
        if not 2 <= len(inputs) <= 10:
            raise ConversionError('INVALID_FILE_COUNT')
        output = BoundedOutput()
        merge_pdfs((path.read_bytes() for path in inputs), output)
        Path(sys.argv[1]).write_bytes(output.getbuffer())
    except MemoryError:
        return 15
    except ConversionError as error:
        return next(code for code, message in CONVERTER_ERRORS.items() if message == str(error))
    return 0


if __name__ == '__main__':
    sys.exit(run())
