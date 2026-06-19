-- Jalankan query ini di Supabase SQL Editor untuk menambahkan user Admin Regional
INSERT INTO app_users (username, password, full_name, role, cabang_id)
VALUES (
    'admin_regional',
    'regional123',
    'Admin Regional',
    'Admin Regional',
    NULL
);
