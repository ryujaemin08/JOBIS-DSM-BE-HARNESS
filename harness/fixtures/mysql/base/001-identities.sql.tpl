DELETE FROM tbl_interview
WHERE id IN ({{INTERVIEW_ID_1}}, {{INTERVIEW_ID_2}}, {{INTERVIEW_ID_3}}, {{INTERVIEW_ID_4}});

DELETE FROM tbl_document_number
WHERE id = {{DOCUMENT_NUMBER_ID}};

DELETE FROM tbl_teacher
WHERE teacher_id = {{TEACHER_ID}};

DELETE FROM tbl_student
WHERE student_id IN ({{STUDENT_ID}}, {{SECOND_STUDENT_ID}});

DELETE FROM tbl_user
WHERE id IN ({{STUDENT_ID}}, {{SECOND_STUDENT_ID}}, {{TEACHER_ID}})
   OR account_id IN ('{{STUDENT_ACCOUNT_ID}}', '{{SECOND_STUDENT_ACCOUNT_ID}}', '{{TEACHER_ACCOUNT_ID}}');

INSERT INTO tbl_user (
    id,
    created_at,
    account_id,
    password,
    authority,
    token
) VALUES
(
    {{STUDENT_ID}},
    NOW(),
    '{{STUDENT_ACCOUNT_ID}}',
    '{{BCRYPT_PASSWORD}}',
    'STUDENT',
    NULL
),
(
    {{SECOND_STUDENT_ID}},
    NOW(),
    '{{SECOND_STUDENT_ACCOUNT_ID}}',
    '{{BCRYPT_PASSWORD}}',
    'STUDENT',
    NULL
),
(
    {{TEACHER_ID}},
    NOW(),
    '{{TEACHER_ACCOUNT_ID}}',
    '{{BCRYPT_PASSWORD}}',
    'TEACHER',
    NULL
);

INSERT INTO tbl_student (
    student_id,
    name,
    grade,
    class_room,
    number,
    gender,
    department,
    profile_image_url,
    entrance_year
) VALUES
(
    {{STUDENT_ID}},
    '{{STUDENT_NAME}}',
    2,
    1,
    1,
    'MAN',
    'SOFTWARE_DEVELOP',
    'EXTENSION_FILE/default_image.png',
    {{CURRENT_YEAR}} - 1
),
(
    {{SECOND_STUDENT_ID}},
    '{{SECOND_STUDENT_NAME}}',
    2,
    1,
    2,
    'WOMAN',
    'SOFTWARE_DEVELOP',
    'EXTENSION_FILE/default_image.png',
    {{CURRENT_YEAR}} - 1
);

INSERT INTO tbl_teacher (
    teacher_id
) VALUES (
    {{TEACHER_ID}}
);

INSERT INTO tbl_document_number (
    id,
    document_number
) VALUES (
    {{DOCUMENT_NUMBER_ID}},
    '{{DOCUMENT_NUMBER_VALUE}}'
);
