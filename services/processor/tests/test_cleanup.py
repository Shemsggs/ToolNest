from unittest.mock import Mock

from app.cleanup import cleanup


def cleanup_database():
    db = Mock()
    files = Mock()
    db.table.return_value = files
    listing = files.select.return_value.lte.return_value.lte.return_value.order.return_value.order.return_value
    listing.limit.return_value.execute.return_value.data = [{'id': 'file', 'storage_path': 'private.pdf'}]
    db.rpc.return_value.execute.return_value.data = [{'user_id': 'eligible-account'}]
    return db, files, db.storage.from_.return_value


def test_cleanup_removes_storage_before_deleting_file_metadata():
    db, files, storage = cleanup_database()
    events = []
    storage.remove.side_effect = lambda paths: events.append(('storage', paths))
    files.delete.return_value.eq.return_value.execute.side_effect = lambda: events.append(('metadata', 'file'))
    assert cleanup(db) == 0
    assert events == [('storage', ['private.pdf']), ('metadata', 'file')]
    db.auth.admin.delete_user.assert_called_once_with('eligible-account')


def test_cleanup_preserves_metadata_when_storage_removal_fails():
    db, files, storage = cleanup_database()
    db.rpc.return_value.execute.return_value.data = []
    storage.remove.side_effect = RuntimeError('Storage unavailable')
    assert cleanup(db) == 1
    files.delete.assert_not_called()
    assert 'cleanup_after' in files.update.call_args.args[0]
    files.update.return_value.eq.assert_called_once_with('id', 'file')
    db.auth.admin.delete_user.assert_not_called()
